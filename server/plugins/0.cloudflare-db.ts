/**
 * Cloudflare D1 binding 注入插件
 * 
 * 在 Cloudflare Pages/Workers 环境中，D1 binding 通过每次请求的 event.context.cloudflare.env.DB
 * 注入。由于 db.ts 中的 useDB() 需要在无 event 上下文的场景（如其他 plugins）使用，
 * 本插件通过钩住第一个请求，将 D1 binding 提取并存储到 globalThis 作为单例。
 */
export default defineNitroPlugin((nitroApp) => {
  // 仅在 Cloudflare Pages 环境下运行
  if (!process.env.CF_PAGES) {
    return
  }

  // 钩住每个请求，提取 D1 binding 并注入到 globalThis
  nitroApp.hooks.hook('request', (event) => {
    // 如果已经注入过，跳过
    if ((globalThis as any).__pinpointD1Binding) {
      return
    }

    const cfEnv = (event.context as any)?.cloudflare?.env
    if (cfEnv?.DB) {
      ;(globalThis as any).__pinpointD1Binding = cfEnv.DB
      console.log('[0.cloudflare-db] D1 binding injected successfully')
    } else {
      console.warn('[0.cloudflare-db] No DB binding found in Cloudflare env. Make sure D1 database is bound as "DB" in wrangler config.')
    }
  })
})
