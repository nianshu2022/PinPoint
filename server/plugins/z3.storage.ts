import path from 'node:path'
import type { LocalStorageConfig, StorageConfig } from '../services/storage'
import { StorageManager, getGlobalStorageManager } from '../services/storage'
import { setGlobalStorageManager } from '../services/storage/events'
import { logger } from '../utils/logger'
import { settingsManager } from '../services/settings/settingsManager'

/**
 * Get the global storage manager instance
 * Used in non-request context (e.g., background tasks, event handlers)
 */
export function getStorageManager() {
  const storageManager = getGlobalStorageManager()
  if (!storageManager) {
    throw new Error('Storage manager not initialized')
  }
  return storageManager
}

console.log('[3.storage] Plugin file loaded!')

export default defineNitroPlugin(async (nitroApp) => {
  await waitForDatabase()
  // Wait for settings migration to complete if still initializing
  // This ensures we get the active provider after config migration
  let activeProvider = await settingsManager.storage.getActiveProvider()
  console.log('[z3.storage] activeProvider initially:', activeProvider?.provider)
  
  if (!activeProvider) {
    console.log('[z3.storage] no active provider, waiting for settingsManager initialization...')
    // Retry while settings manager is still initializing
    let attempts = 0
    const maxAttempts = 100 // 5 seconds max with 50ms intervals
    
    while (!activeProvider && attempts < maxAttempts && settingsManager.isInitializing_()) {
      await new Promise(resolve => setTimeout(resolve, 50))
      activeProvider = await settingsManager.storage.getActiveProvider()
      attempts++
    }
    console.log('[z3.storage] wait loop finished. attempts:', attempts, 'activeProvider:', activeProvider?.provider)
  }
  
  if (!activeProvider) {
    console.error('[z3.storage] No active storage provider configured. Exiting plugin init.')
    logger.storage.error('No active storage provider configured.')
    return
  }

  const storageConfiguration = activeProvider.config

  const storageManager = new StorageManager(
    storageConfiguration,
    logger.storage,
  )

  // 设置全局实例
  setGlobalStorageManager(storageManager)

  // Initialize local storage directory if needed
  const isLocalStorageProvider = (
    provider: StorageConfig,
  ): provider is LocalStorageConfig => {
    return provider?.provider === 'local'
  }

  if (isLocalStorageProvider(storageConfiguration)) {
    const localBase = storageConfiguration.basePath
    try {
      if (!path.isAbsolute(localBase)) {
        logger.storage.warn(`LOCAL basePath is not absolute: ${localBase}`)
      }
      await import('node:fs').then(async (m) => {
        const fs = m.promises as typeof import('node:fs').promises
        await fs.mkdir(localBase, { recursive: true })
      })
      logger.storage.success(`Local storage ready at: ${localBase}`)
    } catch (err) {
      logger.storage.error('Failed to prepare local storage directory', err)
    }
  }

  // Setup event listeners for storage manager
  storageManager.on('provider-changed', async (event) => {
    logger.storage.info(
      `Storage provider changed from ${event.oldProvider} to ${event.provider}`,
    )

    // Re-initialize local storage if switching to local provider
    if (event.provider === 'local') {
      try {
        const newProvider = await settingsManager.storage.getActiveProvider()
        if (
          newProvider &&
          isLocalStorageProvider(newProvider.config)
        ) {
          const localBase = newProvider.config.basePath
          await import('node:fs').then(async (m) => {
            const fs = m.promises as typeof import('node:fs').promises
            await fs.mkdir(localBase, { recursive: true })
          })
          logger.storage.success(`Local storage ready at: ${localBase}`)
        }
      } catch (error) {
        logger.storage.error('Failed to initialize local storage:', error)
      }
    }
  })

  storageManager.on('provider-error', (event) => {
    logger.storage.error(
      `Storage provider error for ${event.provider}: ${event.error?.message}`,
    )
  })

  logger.storage.success('Storage plugin initialized successfully')

  // Set storage manager in context for each request
  nitroApp.hooks.hook('request', (event) => {
    try {
      event.context.storage = getGlobalStorageManager()
    } catch {
      // Storage might not be ready yet during the very first requests
    }
  })
})
