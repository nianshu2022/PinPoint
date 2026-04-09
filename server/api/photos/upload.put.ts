import { useStorageProvider } from '~~/server/utils/useStorageProvider'
import { logger } from '~~/server/utils/logger'
import { fileTypeFromStream } from 'file-type'

export default eventHandler(async (event) => {
  await requireUserSession(event)

  const { storageProvider } = useStorageProvider(event)
  const key = getQuery(event).key as string | undefined
  const t = await useTranslation(event)

  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: t('upload.error.required.title'),
      data: {
        title: t('upload.error.required.title'),
        message: t('upload.error.required.message', { field: 'key' }),
      },
    })
  }

  const contentType = getHeader(event, 'content-type') || 'application/octet-stream'
  
  // MIME 类型白名单验证（可通过环境变量配置）
  const config = useRuntimeConfig(event)
  const whitelistEnabled = config.upload.mime.whitelistEnabled
  
  if (whitelistEnabled) {
    const whitelistStr = config.upload.mime.whitelist
    const allowedTypes = whitelistStr
      ? whitelistStr.split(',').map((type: string) => type.trim()).filter(Boolean)
      : []
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(contentType)) {
      throw createError({
        statusCode: 415,
        statusMessage: t('upload.error.invalidType.title'),
        data: {
          title: t('upload.error.invalidType.title'),
          message: t('upload.error.invalidType.message', { type: contentType }),
          suggestion: t('upload.error.invalidType.suggestion', { allowed: allowedTypes.join(', ') }),
        },
      })
    }
  }
  
  // 不使用 readRawBody，直接取得传入的原始可读流
  const reqStream = event.node.req

  let actualContentType = contentType
  let streamToUpload: any = reqStream

  if (whitelistEnabled) {
    try {
      // fileTypeFromStream 解析前几个字节，然后返回一个可完美对接下游的新流
      const streamWithFileType = await fileTypeFromStream(reqStream)
      streamToUpload = streamWithFileType
      
      if (streamWithFileType.fileType?.mime) {
        actualContentType = streamWithFileType.fileType.mime
      }
      
      const whitelistStr = config.upload.mime.whitelist
      const allowedTypes = whitelistStr
        ? whitelistStr.split(',').map((type: string) => type.trim()).filter(Boolean)
        : []
        
      if (allowedTypes.length > 0 && !allowedTypes.includes(actualContentType)) {
        throw createError({
          statusCode: 415,
          statusMessage: t('upload.error.invalidType.title'),
          data: {
            title: t('upload.error.invalidType.title'),
            message: t('upload.error.invalidType.message', { type: actualContentType }),
            suggestion: t('upload.error.invalidType.suggestion', { allowed: allowedTypes.join(', ') }),
          },
        })
      }
    } catch (e) {
      logger.chrono.warn('Failed to parse stream file-type, falling back to header', e)
    }
  }

  // 大小限制将被交由 Storage 层或 Web 代理 (如 Nginx/CF) 处理，剥离 Node 内存压力。

  try {
    await storageProvider.create(key.replace(/^\/+/, ''), streamToUpload, actualContentType)
  } catch (error) {
    logger.chrono.error('Storage provider create error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: t('upload.error.uploadFailed.title'),
      data: {
        title: t('upload.error.uploadFailed.title'),
        message: t('upload.error.uploadFailed.message'),
      },
    })
  }

  return { ok: true, key }
})

