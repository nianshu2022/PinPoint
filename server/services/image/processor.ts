import path from 'path'
import bmp from '@vingle/bmp-js'
import { getStorageManager } from '~~/server/plugins/z3.storage'
import sharp from 'sharp'
import { withRetry, RetryPresets, RetryConditions } from '../../utils/retry'

// 禁用 sharp 缓存以降低内存占用，这对于低配置服务器（如 2GB 内存）至关重要
// 避免 Sharp 占用过多堆外内存导致 OOM
sharp.cache(false)


export interface ProcessedImageData {
  sharpInst: sharp.Sharp
  imageBuffer: Buffer
  metadata: ImageMeta
}

export interface ImageMeta {
  width: number
  height: number
  format: string
}
// Minimal JPEG size extractor as last-resort fallback
const tryExtractJpegSize = (
  buffer: Buffer,
): { width: number; height: number } | null => {
  // JPEG starts with 0xFFD8
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buffer[offset + 1]
    offset += 2
    // Skip padding FFs
    if (marker === 0xff) continue
    // Standalone markers without length
    if (marker === 0xd8 || marker === 0xd9) continue
    const length = (buffer[offset] << 8) + buffer[offset + 1]
    if (length < 2) break
    // SOF0..SOF3 and SOF5..SOF7 indicate dimensions
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7)
    ) {
      if (offset + 7 >= buffer.length) break
      const height = (buffer[offset + 3] << 8) + buffer[offset + 4]
      const width = (buffer[offset + 5] << 8) + buffer[offset + 6]
      if (width > 0 && height > 0) return { width, height }
      break
    }
    offset += length
  }
  return null
}

const isBitmap = (buffer: Buffer) => {
  if (buffer.length < 2) return false
  const header = buffer.toString('hex', 0, 2)
  return header === '424d'
}

const getMetadataWithSharp = async (
  sharpInst: sharp.Sharp,
): Promise<ImageMeta | null> => {
  try {
    return await withRetry(
      async () => {
        let metadata = await sharpInst.metadata()

        // Fallback 1: try rotate() which can populate dimensions for some orientations
        if (!metadata.height || !metadata.width || !metadata.format) {
          try {
            metadata = await sharpInst.clone().rotate().metadata()
          } catch {
            /* empty */
          }
        }

        // Fallback 2: re-instantiate sharp from a fresh buffer
        if (!metadata.height || !metadata.width || !metadata.format) {
          try {
            const buf = await sharpInst.clone().toBuffer()
            metadata = await sharp(buf).metadata()
          } catch {
            /* empty */
          }
        }

        // Fallback 3: force re-encode to JPEG then read metadata
        if (!metadata.height || !metadata.width || !metadata.format) {
          try {
            const jpegBuf = await sharpInst.clone().jpeg().toBuffer()
            metadata = await sharp(jpegBuf).metadata()
            if (!metadata.height || !metadata.width) {
              const dims = tryExtractJpegSize(jpegBuf)
              if (dims) {
                metadata.width = dims.width
                metadata.height = dims.height
                metadata.format = metadata.format || 'jpeg'
              }
            }
          } catch {
            /* empty */
          }
        }

        if (!metadata.height || !metadata.width || !metadata.format) {
          logger.image.warn('Incomplete metadata received:', {
            hasHeight: !!metadata.height,
            hasWidth: !!metadata.width,
            hasFormat: !!metadata.format,
          })
          return null
        }

        const { orientation } = metadata
        let { width, height } = metadata

        if (orientation && [5, 6, 7, 8].includes(orientation)) {
          ;[width, height] = [height, width]
        }

        logger.image.info(
          `Successfully extracted metadata: ${width}x${height} ${metadata.format}`,
        )
        return {
          width: width,
          height: height,
          format: metadata.format,
        }
      },
      {
        ...RetryPresets.fast,
        timeout: 10000,
        retryCondition: RetryConditions.resourceErrors,
      },
      logger.image,
    )
  } catch (error) {
    logger.image.error('All metadata extraction attempts failed:', error)
    return null
  }
}

// HEIC conversion has been moved to the client side using browser-image-compression.
export const convertBitmapToSharpInst = async (bitmapBuffer: Buffer) => {
  logger.image.info('Converting Bitmap to JPEG...')
  const bmpImage = bmp.decode(bitmapBuffer, true)
  if (!bmpImage) {
    throw new Error('Failed to decode BMP image')
  }

  const channels = bmpImage.data.length / (bmpImage.width * bmpImage.height)
  if (channels !== 3 && channels !== 4) {
    throw new Error(`Unsupported BMP channel count: ${channels}`)
  }

  return sharp(bmpImage.data, {
    raw: { width: bmpImage.width, height: bmpImage.height, channels },
  }).jpeg()
}

export const preprocessImageBuffer = async (
  buffer: Buffer,
  key: string,
): Promise<Buffer> => {
  const extName = path.extname(key).toLowerCase()

  if (['.heic', '.heif', '.hif'].includes(extName)) {
    logger.image.info('HEIC image detected - edge processing unsupported, uploading raw buffer', key)
    return buffer
  }

  return buffer
}

export const preprocessImageWithJpegUpload = async (
  s3key: string,
): Promise<{
  raw: Buffer
  processed: Buffer
  jpegKey?: string // HEIC 转换后上传的 JPEG 文件的 key
} | null> => {
  const storageProvider = getStorageManager().getProvider()
  if (!storageProvider) return null

  try {
    const rawImageBuffer = await storageProvider.get(s3key)
    if (!rawImageBuffer) {
      logger.image.error(`Image not found in storage: ${s3key}`)
      return null
    }

    const extName = path.extname(s3key).toLowerCase()
    let processedBuffer: Buffer
    let jpegKey: string | undefined
    let jpegStorageKey: string | undefined

    if (['.heic', '.heif', '.hif'].includes(extName)) {
      logger.image.info(
        'HEIC image detected, treating as raw unsupported format at edge',
        s3key,
      )
      processedBuffer = rawImageBuffer
    } else {
      processedBuffer = rawImageBuffer
    }

    return {
      raw: rawImageBuffer,
      processed: processedBuffer,
      jpegKey: jpegStorageKey,
    }
  } catch (err) {
    logger.image.error(`Image preprocessing failed: ${s3key}`, err)
    return null
  }
}

export const preprocessImage = async (
  s3key: string,
): Promise<{
  raw: Buffer
  processed: Buffer
} | null> => {
  const storageProvider = getStorageManager().getProvider()
  if (!storageProvider) return null

  try {
    const rawImageBuffer = await storageProvider.get(s3key)
    if (!rawImageBuffer) {
      logger.image.error(`Image not found in storage: ${s3key}`)
      return null
    }

    let imageOrHeicBuffer: Buffer
    try {
      imageOrHeicBuffer = await preprocessImageBuffer(rawImageBuffer, s3key)
    } catch (err) {
      logger.image.error(`Image preprocessing failed: ${s3key}`, err)
      return null
    }

    return {
      raw: rawImageBuffer,
      processed: imageOrHeicBuffer,
    }
  } catch (err) {
    logger.image.error(`Image preprocessing failed: ${s3key}`, err)
    return null
  }
}

export const processImageMetadataAndSharp = async (
  buffer: Buffer,
  s3key: string,
): Promise<ProcessedImageData | null> => {
  try {
    // Disable input pixel limit to avoid failures on very large images
    let sharpInst = sharp(buffer, { limitInputPixels: false })
    let convertedBuffer = buffer

    if (isBitmap(buffer)) {
      logger.image.info('Bitmap image detected, converting to JPEG...', s3key)
      try {
        sharpInst = await convertBitmapToSharpInst(buffer)
        convertedBuffer = await sharpInst.toBuffer()
      } catch (err) {
        logger.image.error(`Bitmap conversion failed: ${s3key}`, err)
        return null
      }
    }

    const metadata = await getMetadataWithSharp(sharpInst)
    if (!metadata) {
      logger.image.error(
        'Metadata extraction returned null (after fallbacks):',
        s3key,
      )
      return null
    }

    return {
      sharpInst,
      imageBuffer: convertedBuffer,
      metadata,
    }
  } catch (err) {
    logger.image.error(`Image processing with Sharp failed: ${s3key}`, err)
    return null
  }
}
