export default eventHandler((event) => {
  return {
    contextKeys: Object.keys(event.context),
    hasCloudflare: !!event.context.cloudflare,
    hasDB: !!(event.context as any).cloudflare?.env?.DB,
    globalDB: !!(globalThis as any).__pinpointD1Binding
  }
})
