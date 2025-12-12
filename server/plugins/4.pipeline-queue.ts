import { WorkerPool } from '../services/pipeline-queue'

export default defineNitroPlugin(async (_nitroApp) => {
  const _logger = logger.dynamic('queue')

  // 从环境变量读取 worker 数量，默认为 2（适合 2GB 内存服务器）
  const workerCount = process.env.QUEUE_WORKER_COUNT
    ? parseInt(process.env.QUEUE_WORKER_COUNT)
    : 2

  const workerPool = new WorkerPool(
    {
      workerCount,
      intervalMs: 1500,
      intervalOffset: 300,
      enableLoadBalancing: true,
      statsReportInterval: 60000 * 10,
    },
    _logger,
  )
  await workerPool.start()

  globalThis.__workerPool = workerPool

  const exitHandler = async () => {
    _logger.info('Shutting down worker pool...')
    await workerPool.stop()
    process.exit(0)
  }

  process.on('SIGINT', exitHandler)
  process.on('SIGTERM', exitHandler)

  // 每 5 分钟进行一次负载均衡检查
  setInterval(
    async () => {
      try {
        await workerPool.rebalance()
      } catch (error) {
        _logger.error('Rebalance failed:', error)
      }
    },
    5 * 60 * 1000,
  )
})
