import type { H3Event, EventHandlerRequest } from 'h3'
import type { StorageProvider } from '../services/storage'

export const useStorageProvider = (event: H3Event<EventHandlerRequest>) => {
  const storageProvider =
    event.context?.storage?.getProvider() as StorageProvider
  if (!storageProvider) {
    console.log('useStorageProvider Error: context.storage is', !!event.context?.storage, 'active mode')
    throw createError({
      statusCode: 503,
      message: 'Service Unavailable'
    })
  }
  return { storageProvider }
}
