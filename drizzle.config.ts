import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    // 本地开发使用 better-sqlite3，路径可通过 DB_PATH 环境变量覆盖
    url: process.env.DB_PATH || 'file:./data/sqlite.db'
  }
})
