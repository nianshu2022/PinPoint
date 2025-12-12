import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { exiftool } from 'exiftool-vendored'
import { eq } from 'drizzle-orm'

import { extractExifData } from '~~/server/services/image/exif'
import { tables, useDB } from '~~/server/utils/db'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

const paramsSchema = z.object({
  photoId: z.string().min(1),
})

const bodySchema = z.object({
  title: z.string().trim().max(512).optional(),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().max(128)).max(64).optional(),
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
  rating: z.union([z.number().int().min(0).max(5), z.null()]).optional(),
  dateTaken: z.string().datetime().optional(),
})

const normalizeTags = (tags: string[] | undefined) => {
  if (!tags) return undefined
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const rawTag of tags) {
    const trimmed = rawTag.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }
  return normalized
}

export default eventHandler(async (event) => {
  await requireUserSession(event)

  const t = await useTranslation(event)
  const { photoId } = paramsSchema.parse(event.context.params ?? {})
  const payload = bodySchema.parse(await readBody(event))

  if (
    payload.title === undefined &&
    payload.description === undefined &&
    payload.tags === undefined &&
    payload.location === undefined &&
    payload.rating === undefined &&
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
  const photo = await db
    .select()
    .from(tables.photos)
    .where(eq(tables.photos.id, photoId))
    .get()

  if (!photo) {
    throw createError({
      statusCode: 404,
      statusMessage: t('dashboard.photos.messages.photoNotFound'),
    })
  }

  if (!photo.storageKey) {
    throw createError({
      statusCode: 400,
      statusMessage: t('dashboard.photos.messages.noStorageKey'),
    })
  }

  const { storageProvider } = useStorageProvider(event)
  const originalBuffer = await storageProvider.get(photo.storageKey)

  if (!originalBuffer) {
    throw createError({
      statusCode: 404,
      statusMessage: t('dashboard.photos.messages.photoFileMissing'),
    })
  }

  const normalizedTitle =
    payload.title !== undefined ? payload.title.trim() : undefined
  const normalizedDescription =
    payload.description !== undefined ? payload.description.trim() : undefined
  // Treat empty strings as null
  const normalizedCountry =
    payload.country !== undefined &&
    payload.country !== null &&
    payload.country.trim() === ''
      ? null
      : payload.country
  const normalizedCity =
    payload.city !== undefined &&
    payload.city !== null &&
    payload.city.trim() === ''
      ? null
      : payload.city
  const normalizedTags = normalizeTags(payload.tags)
  let pendingReverseGeocode: {
    latitude: number
    longitude: number
  } | null = null

  const exifUpdates: Record<string, any> = {}

  if (normalizedTitle !== undefined) {
    const titleValue = normalizedTitle.length > 0 ? normalizedTitle : null
    exifUpdates.Title = titleValue
    exifUpdates.XPTitle = titleValue
  }

  if (normalizedDescription !== undefined) {
    const descriptionValue =
      normalizedDescription.length > 0 ? normalizedDescription : null
    exifUpdates.Description = descriptionValue
    exifUpdates.ImageDescription = descriptionValue
    exifUpdates.CaptionAbstract = descriptionValue
    exifUpdates.XPComment = descriptionValue
    exifUpdates.UserComment = descriptionValue
  }

  if (normalizedTags !== undefined) {
    const tagsValue = normalizedTags.length > 0 ? normalizedTags : null
    exifUpdates.Subject = tagsValue
    exifUpdates.Keywords = tagsValue
    exifUpdates.XPKeywords =
      normalizedTags.length > 0 ? normalizedTags.join('; ') : null
  }

  if (payload.location !== undefined) {
    if (payload.location) {
      const { latitude, longitude } = payload.location
      const latAbs = Math.abs(latitude)
      const lonAbs = Math.abs(longitude)
      exifUpdates.GPSLatitude = latAbs
      exifUpdates.GPSLatitudeRef = latitude >= 0 ? 'N' : 'S'
      exifUpdates.GPSLongitude = lonAbs
      exifUpdates.GPSLongitudeRef = longitude >= 0 ? 'E' : 'W'
      exifUpdates.GPSPosition = `${latitude} ${longitude}`
    } else {
      exifUpdates.GPSLatitude = null
      exifUpdates.GPSLatitudeRef = null
      exifUpdates.GPSLongitude = null
      exifUpdates.GPSLongitudeRef = null
      exifUpdates.GPSPosition = null
    }
  }

  if (payload.rating !== undefined) {
    exifUpdates.Rating = payload.rating !== null ? payload.rating : null
  }

  if (payload.dateTaken !== undefined) {
    // Update multiple EXIF date fields for compatibility
    const dateTaken = payload.dateTaken ? new Date(payload.dateTaken) : null
    if (dateTaken && !isNaN(dateTaken.getTime())) {
      // Format: YYYY:MM:DD HH:MM:SS (EXIF standard format)
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
      // Clear date fields if null
      exifUpdates.DateTimeOriginal = null
      exifUpdates.DateTimeDigitized = null
      exifUpdates.DateTime = null
      exifUpdates.CreateDate = null
      exifUpdates.ModifyDate = null
    }
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'cframe-edit-'))
  const ext = path.extname(photo.storageKey) || '.jpg'
  const tempFile = path.join(tempDir, `edited${ext}`)

  try {
    await writeFile(tempFile, originalBuffer)

    if (Object.keys(exifUpdates).length > 0) {
      await exiftool.write(tempFile, exifUpdates, ['-overwrite_original'])
    }

    const updatedBuffer = await readFile(tempFile)
    const prefix =
      storageProvider.config && 'prefix' in storageProvider.config
        ? storageProvider.config.prefix
        : ''
    await storageProvider.create(
      photo.storageKey.replace(prefix || '', ''),
      updatedBuffer,
    )

    const exifData = await extractExifData(updatedBuffer)

    const updateData: Record<string, any> = {
      exif: exifData,
      fileSize: updatedBuffer.length,
      lastModified: new Date().toISOString(),
    }

    if (normalizedTitle !== undefined) {
      updateData.title = normalizedTitle || null
    }

    if (normalizedDescription !== undefined) {
      updateData.description = normalizedDescription || null
    }

    if (normalizedTags !== undefined) {
      updateData.tags = normalizedTags
    }

    // Only update location fields if they are provided
    if (normalizedCountry !== undefined) {
      updateData.country = normalizedCountry
    }
    if (normalizedCity !== undefined) {
      updateData.city = normalizedCity
    }

    if (payload.location !== undefined) {
      if (payload.location) {
        updateData.latitude = payload.location.latitude
        updateData.longitude = payload.location.longitude
        
        // If latitude/longitude changed but country/city weren't manually provided, 
        // clear them to allow reverse geocoding to fill them later.
        // If manually provided, they will be set above and preserved here.
        if (normalizedCountry === undefined) updateData.country = null
        if (normalizedCity === undefined) updateData.city = null
        
        updateData.locationName = null
        pendingReverseGeocode = {
          latitude: payload.location.latitude,
          longitude: payload.location.longitude,
        }
      } else {
        updateData.latitude = null
        updateData.longitude = null
        
        // Only clear if not manually setting them
        if (normalizedCountry === undefined) updateData.country = null
        if (normalizedCity === undefined) updateData.city = null
        
        updateData.locationName = null
      }
    }

    if (payload.dateTaken !== undefined) {
      updateData.dateTaken = payload.dateTaken || null
    }

    await db
      .update(tables.photos)
      .set(updateData)
      .where(eq(tables.photos.id, photoId))

    const updatedPhoto = await db
      .select()
      .from(tables.photos)
      .where(eq(tables.photos.id, photoId))
      .get()

    if (pendingReverseGeocode) {
      const workerPool = globalThis.__workerPool
      if (workerPool) {
        try {
          await workerPool.addTask(
            {
              type: 'photo-reverse-geocoding',
              photoId,
              latitude: pendingReverseGeocode.latitude,
              longitude: pendingReverseGeocode.longitude,
            },
            {
              priority: 1,
            },
          )
        } catch (taskError) {
          logger.location.warn(
            `Failed to enqueue reverse geocoding for photo ${photoId}:`,
            taskError,
          )
        }
      } else {
        logger.location.warn(
          `Worker pool not initialized, skipping reverse geocoding enqueue for photo ${photoId}`,
        )
      }
    }

    return {
      success: true,
      photo: updatedPhoto,
    }
  } catch (error) {
    logger.image.error('Failed to update photo metadata', error)
    throw createError({
      statusCode: 500,
      statusMessage: t('dashboard.photos.messages.metadataUpdateFailed'),
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
