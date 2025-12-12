import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { tables, useDB } from '~~/server/utils/db'

const bodySchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1),
  location: z
    .union([
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
      z.null(),
    ])
    .optional(),
  country: z.string().trim().max(128).nullable().optional(),
  city: z.string().trim().max(128).nullable().optional(),
  dateTaken: z.string().datetime().optional(),
})

export default eventHandler(async (event) => {
  await requireUserSession(event)

  const t = await useTranslation(event)
  const payload = bodySchema.parse(await readBody(event))

  if (
    payload.location === undefined &&
    payload.dateTaken === undefined &&
    payload.country === undefined &&
    payload.city === undefined
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: t('dashboard.photos.messages.noChangesProvided'),
    })
  }

  const db = useDB()
  const photos = await db
    .select()
    .from(tables.photos)
    .where(inArray(tables.photos.id, payload.photoIds))
    .all()

  if (photos.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: t('dashboard.photos.messages.photoNotFound'),
    })
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ id: string; error: string }>,
  }

  const exifUpdates: Record<string, any> = {}

  // Handle Location for EXIF
  if (payload.location !== undefined && payload.location) {
    const { latitude, longitude } = payload.location
    const latAbs = Math.abs(latitude)
    const lonAbs = Math.abs(longitude)
    exifUpdates.GPSLatitude = latAbs
    exifUpdates.GPSLatitudeRef = latitude >= 0 ? 'N' : 'S'
    exifUpdates.GPSLongitude = lonAbs
    exifUpdates.GPSLongitudeRef = longitude >= 0 ? 'E' : 'W'
    exifUpdates.GPSPosition = `${latitude} ${longitude}`
  } else if (payload.location === null) {
    exifUpdates.GPSLatitude = null
    exifUpdates.GPSLatitudeRef = null
    exifUpdates.GPSLongitude = null
    exifUpdates.GPSLongitudeRef = null
    exifUpdates.GPSPosition = null
  }

  // Handle Date Taken for EXIF
  if (payload.dateTaken !== undefined) {
    const dateTaken = payload.dateTaken ? new Date(payload.dateTaken) : null
    if (dateTaken && !isNaN(dateTaken.getTime())) {
      const year = dateTaken.getFullYear()
      const month = String(dateTaken.getMonth() + 1).padStart(2, '0')
      const day = String(dateTaken.getDate()).padStart(2, '0')
      const hours = String(dateTaken.getHours()).padStart(2, '0')
      const minutes = String(dateTaken.getMinutes()).padStart(2, '0')
      const seconds = String(dateTaken.getSeconds()).padStart(2, '0')
      const exifDateTime = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`

      exifUpdates.DateTimeOriginal = exifDateTime
      exifUpdates.DateTimeDigitized = exifDateTime
      exifUpdates.DateTime = exifDateTime
      exifUpdates.CreateDate = exifDateTime
      exifUpdates.ModifyDate = exifDateTime
    } else {
      exifUpdates.DateTimeOriginal = null
      exifUpdates.DateTimeDigitized = null
      exifUpdates.DateTime = null
      exifUpdates.CreateDate = null
      exifUpdates.ModifyDate = null
    }
  }

  // Prepare DB updates
  const updateData: Record<string, any> = {
    lastModified: new Date().toISOString(),
  }

  if (payload.country !== undefined) {
    updateData.country =
      payload.country !== null && payload.country.trim() === ''
        ? null
        : payload.country
  }

  if (payload.city !== undefined) {
    updateData.city =
      payload.city !== null && payload.city.trim() === '' ? null : payload.city
  }

  if (payload.location !== undefined) {
    if (payload.location) {
      updateData.latitude = payload.location.latitude
      updateData.longitude = payload.location.longitude
      
      // If location changed but country/city not provided manually, clear them
      if (payload.country === undefined) updateData.country = null
      if (payload.city === undefined) updateData.city = null
      
      updateData.locationName = null
    } else {
      updateData.latitude = null
      updateData.longitude = null
      
      // Only clear if not manually setting them
      if (payload.country === undefined) updateData.country = null
      if (payload.city === undefined) updateData.city = null
      
      updateData.locationName = null
    }
  }

  if (payload.dateTaken !== undefined) {
    updateData.dateTaken = payload.dateTaken || null
  }

  try {
    // 1. Immediate DB update
    await db
      .update(tables.photos)
      .set(updateData)
      .where(inArray(tables.photos.id, payload.photoIds))
      .run()

    // 2. Queue background tasks
    const workerPool = globalThis.__workerPool
    if (workerPool) {
      for (const photo of photos) {
        // Queue reverse geocoding if location changed
        if (payload.location && payload.location.latitude) {
          workerPool
            .addTask(
              {
                type: 'photo-reverse-geocoding',
                photoId: photo.id,
                latitude: payload.location.latitude,
                longitude: payload.location.longitude,
              },
              { priority: 1 },
            )
            .catch((e) => console.warn('Failed to queue reverse geocoding', e))
        }

        // Queue EXIF update
        workerPool
          .addTask(
            {
              type: 'write-exif',
              photoId: photo.id,
              updates: exifUpdates,
            },
            { priority: 0 }, // Low priority
          )
          .catch((e) => console.warn('Failed to queue exif update', e))

        results.success++
      }
    }
  } catch (error) {
    console.error('Batch update failed', error)
    if (results.success === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
})
