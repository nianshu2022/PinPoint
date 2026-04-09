import { desc, lt } from 'drizzle-orm'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)
  const query = getQuery(event)
  const limitCount = Number(query.limit) || 50
  const cursorStr = query.cursor ? String(query.cursor) : null

  let q = useDB().select().from(tables.photos).orderBy(desc(tables.photos.dateTaken))
  
  if (cursorStr) {
    q = q.where(lt(tables.photos.dateTaken, cursorStr)) as any
  }
  
  const rawPhotos = await q.limit(limitCount).all()

  // 动态生成正确的 URL，覆盖数据库中可能存在的旧 URL
  const items = rawPhotos.map((photo) => ({
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
  
  return {
    items,
    nextCursor: items.length === limitCount && items[items.length - 1].dateTaken ? items[items.length - 1].dateTaken : null,
  }
})
