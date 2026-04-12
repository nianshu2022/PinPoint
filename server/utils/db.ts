import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleNode } from 'drizzle-orm/better-sqlite3'

import * as schema from '../database/schema'
import path from 'node:path'

export const tables = schema
export { eq, and, or, inArray } from 'drizzle-orm'


// @ts-ignore Node.js specific module import bypasses Nuxt TS strict checks
import { createRequire } from 'node:module'
const customRequire = typeof require !== 'undefined' ? require : createRequire(import.meta.url)

// 创建单例数据库连接
let dbInstance: any = null

export function useDB() {
  if (!dbInstance) {
    // 优先使用挂载在 globalThis 上的原生 Cloudflare D1 binding
    // 由 server/plugins/0.cloudflare-db.ts 在 Cloudflare 环境启动时注入
    const d1Binding = (globalThis as any).__pinpointD1Binding
    if (d1Binding) {
      try {
        dbInstance = drizzleD1(d1Binding, { schema })
      } catch (e) {
        console.error('[db] Error initializing D1 via native binding:', e)
      }
    }

    // 降级使用 local better-sqlite3 引擎
    if (!dbInstance && !process.env.CF_PAGES) {
      try {
        // 利用字符串拼接避免被 Vite/Rollup 静态分析拦截引发在不包含依赖情况下的打包报错
        const betterSqlite3Database = customRequire('better' + '-sqlite3')
        if (betterSqlite3Database) {
          const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'sqlite.db')
          const sqlite = new betterSqlite3Database(dbPath)
          sqlite.pragma('journal_mode = WAL')
          sqlite.pragma('synchronous = NORMAL')
          dbInstance = drizzleNode(sqlite, { schema })
        }
      } catch (e) {
        console.warn('[db] Failed to load better-sqlite3 locally')
      }
    }

    if (!dbInstance) {
      throw new Error('[db] Cannot initialize any database interface!')
    }
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
    console.log('[db] Waiting for DB binding to be ready...')
    let attempts = 0
    const maxAttempts = 50
    while (attempts < maxAttempts) {
      try {
        const db = useDB()
        if (db) {
          await db.select().from(schema.settings).limit(1)
          console.log('[db] DB binding is ready!')
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
