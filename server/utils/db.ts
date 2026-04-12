import { drizzle } from 'drizzle-orm/d1'

import * as schema from '../database/schema'

export const tables = schema
export { eq, and, or, inArray } from 'drizzle-orm'

// 创建单例数据库连接
let dbInstance: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!dbInstance) {
    dbInstance = drizzle(hubDatabase(), { schema })
  }

  return dbInstance
}

// 优雅关闭数据库连接
export function closeDB() {
  dbInstance = null
}

let dbWaitPromise: Promise<void> | null = null

export async function waitForDatabase(): Promise<void> {
  if (dbWaitPromise) return dbWaitPromise

  dbWaitPromise = new Promise(async (resolve, reject) => {
    console.log('[db] Waiting for Cloudflare DB binding to be ready...')
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      try {
        const db = useDB()
        if (db) {
          await db.select().from(schema.settings).limit(1)
          console.log('[db] Cloudflare DB binding is ready!')
          resolve()
          return
        }
      } catch (e) {
        // Ignored, DB not ready
        await new Promise(r => setTimeout(r, 200))
      }
      attempts++
    }
    console.error('[db] Failed to connect to DB after 10 seconds.')
    reject(new Error('DB not ready'))
  })

  return dbWaitPromise
}

export type User = typeof schema.users.$inferSelect
export type Photo = typeof schema.photos.$inferSelect

export type PipelineQueueItem = typeof schema.pipelineQueue.$inferSelect
export type NewPipelineQueueItem = typeof schema.pipelineQueue.$inferInsert

export type PhotoReaction = typeof schema.photoReactions.$inferSelect

export type Album = typeof schema.albums.$inferSelect
export type NewAlbum = typeof schema.albums.$inferInsert
export type AlbumPhoto = typeof schema.albumPhotos.$inferSelect
export type NewAlbumPhoto = typeof schema.albumPhotos.$inferInsert
export type AlbumWithPhotos = Album & {
  photos: Photo[]
}
