import { eq } from 'drizzle-orm'
import { tables, useDB } from '~~/server/utils/db'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

/**
 * 更新所有照片的 originalUrl 和 thumbnailUrl
 * 用于修复 URL 格式（例如从路径样式改为虚拟主机样式）
 */
export default eventHandler(async (event) => {
  await requireUserSession(event)

  const { storageProvider } = useStorageProvider(event)
  const db = useDB()

  // 获取所有照片
  const photos = await db.select().from(tables.photos).all()

  if (photos.length === 0) {
    return {
      success: true,
      message: '没有照片需要更新',
      updated: 0,
    }
  }

  let updated = 0
  const errors: Array<{ photoId: string; error: string }> = []

  for (const photo of photos) {
    try {
      const updateData: Record<string, string | null> = {}

      // 更新 originalUrl
      if (photo.storageKey) {
        updateData.originalUrl = storageProvider.getPublicUrl(photo.storageKey)
      }

      // 更新 thumbnailUrl
      if (photo.thumbnailKey) {
        updateData.thumbnailUrl = storageProvider.getPublicUrl(photo.thumbnailKey)
      }

      // 更新 livePhotoVideoUrl
      if (photo.livePhotoVideoKey) {
        updateData.livePhotoVideoUrl = storageProvider.getPublicUrl(
          photo.livePhotoVideoKey,
        )
      }

      // 只更新有变化的字段
      if (Object.keys(updateData).length > 0) {
        await db
          .update(tables.photos)
          .set(updateData)
          .where(eq(tables.photos.id, photo.id))

        updated++
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        photoId: photo.id,
        error: errorMessage,
      })
    }
  }

  return {
    success: true,
    message: `已更新 ${updated} 张照片的 URL`,
    updated,
    total: photos.length,
    errors: errors.length > 0 ? errors : undefined,
  }
})

