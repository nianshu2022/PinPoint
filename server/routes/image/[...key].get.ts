import { logger } from '~~/server/utils/logger'

const guessContentType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    case 'tiff':
    case 'tif':
      return 'image/tiff'
    case 'heic':
    case 'heif':
      return 'image/heic'
    case 'mov':
      return 'video/quicktime'
    case 'mp4':
      return 'video/mp4'
    default:
      return 'application/octet-stream'
  }
}

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)
  const keyParam = getRouterParam(event, 'key')

  if (!keyParam) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key' })
  }

  // Handle array case for [...key] route
  const keyRaw = Array.isArray(keyParam) ? keyParam.join('/') : keyParam
  const decodedKey = decodeURIComponent(keyRaw)
  
  const photo = await storageProvider.get(decodedKey)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  
  // Set appropriate content type
  const contentType = guessContentType(decodedKey)
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  
  logger.chrono.info('Serve image from key', decodedKey)
  return photo
})
