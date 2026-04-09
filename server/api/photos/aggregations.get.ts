import { tables, useDB } from '~~/server/utils/db'

export default eventHandler(async (event) => {
  const db = useDB()
  
  const allPhotos = await db.select({
    tags: tables.photos.tags,
    exif: tables.photos.exif,
    city: tables.photos.city
  }).from(tables.photos).all()

  const stats = {
    tags: new Map<string, number>(),
    cameras: new Map<string, number>(),
    lenses: new Map<string, number>(),
    cities: new Map<string, number>(),
    ratings: new Map<number, number>()
  }

  for (const photo of allPhotos) {
    if (photo.tags && Array.isArray(photo.tags)) {
      for (const tag of photo.tags) {
        stats.tags.set(tag, (stats.tags.get(tag) || 0) + 1)
      }
    }
    
    if (photo.exif?.Make && photo.exif?.Model) {
      const camera = `${photo.exif.Make} ${photo.exif.Model}`
      stats.cameras.set(camera, (stats.cameras.get(camera) || 0) + 1)
    }

    if (photo.exif?.LensMake && photo.exif?.LensModel) {
      const lens = `${photo.exif.LensMake} ${photo.exif.LensModel}`
      stats.lenses.set(lens, (stats.lenses.get(lens) || 0) + 1)
    } else if (photo.exif?.LensModel) {
      stats.lenses.set(photo.exif.LensModel, (stats.lenses.get(photo.exif.LensModel) || 0) + 1)
    }

    if (photo.city) {
      stats.cities.set(photo.city, (stats.cities.get(photo.city) || 0) + 1)
    }

    if (photo.exif?.Rating && photo.exif.Rating > 0) {
      const rating = photo.exif.Rating
      stats.ratings.set(rating, (stats.ratings.get(rating) || 0) + 1)
    }
  }

  return {
    tags: Array.from(stats.tags.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    cameras: Array.from(stats.cameras.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count })),
    lenses: Array.from(stats.lenses.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count })),
    cities: Array.from(stats.cities.entries()).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    ratings: Array.from(stats.ratings.entries()).sort((a, b) => b[0] - a[0]).map(([label, count]) => ({ label, count }))
  }
})
