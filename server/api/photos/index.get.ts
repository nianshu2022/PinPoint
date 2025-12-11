import { desc } from 'drizzle-orm'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)
  const photos = await useDB()
    .select()
    .from(tables.photos)
    .orderBy(desc(tables.photos.dateTaken))
    .all()

  // 动态生成正确的 URL，覆盖数据库中可能存在的旧 URL
  return photos.map((photo) => ({
    ...photo,
    originalUrl: photo.storageKey
      ? storageProvider.getPublicUrl(photo.storageKey)
      : photo.originalUrl,
    thumbnailUrl: photo.thumbnailKey
      ? storageProvider.getPublicUrl(photo.thumbnailKey)
      : photo.thumbnailUrl,
    livePhotoVideoUrl: photo.livePhotoVideoKey
      ? storageProvider.getPublicUrl(photo.livePhotoVideoKey)
      : photo.livePhotoVideoUrl,
  }))
})
