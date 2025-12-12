import { z } from 'zod'
import { inArray } from 'drizzle-orm'

const bodySchema = z.object({
  photoIds: z.array(z.string()),
})

export default eventHandler(async (event) => {
  await requireUserSession(event)
  const { photoIds } = await readValidatedBody(event, bodySchema.parse)

  if (photoIds.length === 0) {
    return { success: true, count: 0 }
  }

  const db = useDB()

  // 1. 获取要删除的照片信息（为了之后清理文件）
  const photosToDelete = await db
    .select()
    .from(tables.photos)
    .where(inArray(tables.photos.id, photoIds))
    .all()

  if (photosToDelete.length === 0) {
    return { success: true, count: 0 }
  }

  // 2. 从数据库删除记录（这将立即从 UI 中消失）
  await db
    .delete(tables.photos)
    .where(inArray(tables.photos.id, photoIds))
    .run()

  // 3. 将文件清理任务放入后台队列
  const workerPool = globalThis.__workerPool
  if (workerPool) {
    for (const photo of photosToDelete) {
      if (photo.storageKey) {
        workerPool
          .addTask(
            {
              type: 'cleanup-storage',
              storageKey: photo.storageKey,
              thumbnailKey: photo.thumbnailKey,
              livePhotoVideoKey: photo.livePhotoVideoKey,
            },
            { priority: 2 }, // 清理任务优先级稍高
          )
          .catch((e) => console.error('Failed to queue cleanup task', e))
      }
    }
  }

  return { success: true, count: photosToDelete.length }
})

