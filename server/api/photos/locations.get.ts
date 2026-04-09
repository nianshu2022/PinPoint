import { desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const photos = await useDB()
    .select({
      id: tables.photos.id,
      lat: tables.photos.lat,
      lng: tables.photos.lng,
      locationName: tables.photos.locationName,
      country: tables.photos.country,
      city: tables.photos.city,
      dateTaken: tables.photos.dateTaken,
      thumbnailUrl: tables.photos.thumbnailUrl,
      thumbnailKey: tables.photos.thumbnailKey,
    })
    .from(tables.photos)
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  return photos
})
