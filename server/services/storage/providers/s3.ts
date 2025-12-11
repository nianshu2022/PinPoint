import type { _Object, S3ClientConfig } from '@aws-sdk/client-s3'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  StorageObject,
  StorageProvider,
  UploadOptions,
} from '../interfaces'

// Clean and validate access key
const cleanAccessKey = (key: string | undefined): string => {
  if (!key) return ''
  // Remove whitespace and trim
  return key.trim().replace(/\s+/g, '')
}

// Validate access key format
const validateAccessKey = (accessKeyId: string, secretAccessKey: string): void => {
  const cleanedKeyId = cleanAccessKey(accessKeyId)
  const cleanedSecret = cleanAccessKey(secretAccessKey)
  
  if (!cleanedKeyId || !cleanedSecret) {
    throw new Error('Access Key ID and Secret Access Key are required')
  }
  
  // Common access key formats:
  // AWS: AKIA... (20 chars)
  // Tencent Cloud: AKID... (varies)
  // Alibaba Cloud: LTAI... (varies)
  // MinIO: minioadmin (varies)
  
  // Basic validation: should not contain spaces, should be at least 8 characters
  if (cleanedKeyId.length < 8) {
    throw new Error('Access Key ID format is invalid: too short (minimum 8 characters)')
  }
  
  if (cleanedSecret.length < 8) {
    throw new Error('Secret Access Key format is invalid: too short (minimum 8 characters)')
  }
  
  // Check for common invalid characters
  if (/[\s\n\r\t]/.test(cleanedKeyId) || /[\s\n\r\t]/.test(cleanedSecret)) {
    throw new Error('Access Key contains invalid whitespace characters')
  }
}

const createClient = (config: S3StorageConfig): S3Client => {
  if (config.provider !== 's3') {
    throw new Error('Invalid provider for S3 client creation')
  }

  const { accessKeyId, secretAccessKey, region, endpoint } = config
  
  // Clean and validate access keys
  const cleanedAccessKeyId = cleanAccessKey(accessKeyId)
  const cleanedSecretAccessKey = cleanAccessKey(secretAccessKey)
  
  validateAccessKey(cleanedAccessKeyId, cleanedSecretAccessKey)

  // Tencent Cloud COS requires virtual-hosted style, not path style
  // Force path style to false for Tencent COS
  const isTencentCOS = endpoint && endpoint.includes('myqcloud.com')
  const shouldForcePathStyle = isTencentCOS ? false : (config.forcePathStyle ?? false)

  const clientConfig: S3ClientConfig = {
    endpoint,
    region,
    forcePathStyle: shouldForcePathStyle,
    responseChecksumValidation: 'WHEN_REQUIRED',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: cleanedAccessKeyId,
      secretAccessKey: cleanedSecretAccessKey,
    },
  }

  return new S3Client(clientConfig)
}

const convertToStorageObject = (s3object: _Object): StorageObject => {
  return {
    key: s3object.Key || '',
    size: s3object.Size,
    lastModified: s3object.LastModified,
    etag: s3object.ETag,
  }
}

export class S3StorageProvider implements StorageProvider {
  config: S3StorageConfig
  private logger?: Logger['storage']
  private client: S3Client

  constructor(config: S3StorageConfig, logger?: Logger['storage']) {
    this.config = config
    this.logger = logger
    this.client = createClient(config)
  }

  async create(
    key: string,
    data: Buffer,
    contentType?: string,
  ): Promise<StorageObject> {
    try {
      const absoluteKey =
        `${(this.config.prefix || '').replace(/\/+$/, '')}/${key}`.replace(
          /^\/+/,
          '',
        )
      const cmd = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: absoluteKey,
        Body: data,
        ContentType: contentType || 'application/octet-stream',
      })

      const resp = await this.client.send(cmd)

      this.logger?.success(`Created object with key: ${absoluteKey}`)

      return {
        key: absoluteKey,
        size: data.length,
        lastModified: new Date(),
        etag: resp.ETag,
      }
    } catch (error) {
      this.logger?.error(`Failed to create object with key: ${key}`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cmd = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      await this.client.send(cmd)
      this.logger?.success(`Deleted object with key: ${key}`)
    } catch (error) {
      this.logger?.error(`Failed to delete object with key: ${key}`, error)
      throw error
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const cmd = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      const resp = await this.client.send(cmd)

      if (!resp.Body) {
        return null
      }

      if (resp.Body instanceof Buffer) {
        return resp.Body
      }

      // Use the transformToByteArray helper if available (AWS SDK v3)
      if (typeof (resp.Body as any).transformToByteArray === 'function') {
        const byteArray = await (resp.Body as any).transformToByteArray()
        return Buffer.from(byteArray)
      }

      // Fallback to stream reading
      const chunks: Uint8Array[] = []
      const stream = resp.Body as NodeJS.ReadableStream

      return new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Uint8Array) => {
          chunks.push(chunk)
        })

        stream.on('end', () => {
          resolve(Buffer.concat(chunks))
        })

        stream.on('error', (err) => {
          reject(err)
        })
      })
    } catch (error) {
      // Log specific error if needed
      // this.logger?.error(`Failed to get object: ${key}`, error)
      return null
    }
  }

  getPublicUrl(key: string): string {
    const { cdnUrl, bucket, region, endpoint } = this.config

    // CDN URL (highest priority)
    if (cdnUrl) {
      return `${cdnUrl.replace(/\/$/, '')}/${key}`
    }

    // Use proxy in development to avoid CORS issues
    // Set NUXT_PROVIDER_S3_USE_PROXY=true to enable proxy mode
    // Set NUXT_PROVIDER_S3_USE_PROXY=false to explicitly disable proxy mode
    const explicitProxyEnabled = process.env.NUXT_PROVIDER_S3_USE_PROXY === 'true'
    const explicitProxyDisabled = process.env.NUXT_PROVIDER_S3_USE_PROXY === 'false'
    
    // Default to proxy in development unless explicitly disabled
    const useProxy = explicitProxyEnabled || 
                     (process.env.NODE_ENV === 'development' && !cdnUrl && !explicitProxyDisabled)
    
    if (useProxy) {
      // Use server-side proxy route to avoid CORS issues
      const encodedKey = encodeURIComponent(key)
      return `/api/image/${encodedKey}`
    }

    // Default AWS S3 endpoint
    if (!endpoint) {
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    } else if (endpoint.includes('amazonaws.com')) {
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    }

    // Alibaba Cloud OSS
    if (endpoint.includes('aliyuncs.com')) {
      const baseUrl = endpoint.replace(/\/$/, '')
      if (baseUrl.indexOf('//') === -1) {
        throw new Error('Invalid endpoint URL')
      }
      const protocol = baseUrl.split('//')[0]
      const remainder = baseUrl.split('//')[1]
      return `${protocol}//${bucket}.${remainder}/${key}`
    }

    // Tencent Cloud COS
    if (endpoint.includes('myqcloud.com')) {
      // Tencent COS REQUIRES virtual-hosted style (PathStyleDomainForbidden error if using path style)
      // Format: https://bucket-name.cos.region.myqcloud.com/path
      // Note: bucket name format is "bucket-name-APPID", use the full bucket name
      const regionPart = endpoint.match(/cos\.([^.]+)\.myqcloud\.com/)?.[1] || region
      if (regionPart && regionPart !== 'auto') {
        // Always use virtual-hosted style for Tencent COS
        // Use full bucket name (includes APPID suffix)
        return `https://${bucket}.cos.${regionPart}.myqcloud.com/${key}`
      }
      // If region is not clear, use the region from config or default
      const finalRegion = (region && region !== 'auto') ? region : 'ap-beijing'
      return `https://${bucket}.cos.${finalRegion}.myqcloud.com/${key}`
    }

    // Custom endpoint (fallback)
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
  }

  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    options?: UploadOptions,
  ): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: options?.contentType || 'application/octet-stream',
    })

    const url = await getSignedUrl(this.client, cmd, {
      expiresIn,
      // 为了更好的 CORS 支持，添加一些额外参数
      unhoistableHeaders: new Set(['Content-Type']),
    })
    return url
  }

  async getFileMeta(key: string): Promise<StorageObject | null> {
    try {
      const cmd = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      })

      const resp = await this.client.send(cmd)

      if (!resp.ETag) {
        return null
      }

      return {
        key,
        size: resp.ContentLength || 0,
        lastModified: resp.LastModified,
        etag: resp.ETag,
      }
    } catch (error) {
      if ((error as any).$metadata?.httpStatusCode === 404) {
        return null
      }
      this.logger?.error(`Failed to get metadata for key: ${key}`, error)
      throw error
    }
  }

  async listAll(): Promise<StorageObject[]> {
    const cmd = new ListObjectsCommand({
      Bucket: this.config.bucket,
      Prefix: this.config.prefix,
      MaxKeys: this.config.maxKeys,
    })

    const resp = await this.client.send(cmd)
    this.logger?.log(resp.Contents?.map(convertToStorageObject))
    return resp.Contents?.map(convertToStorageObject) || []
  }

  async listImages(): Promise<StorageObject[]> {
    const cmd = new ListObjectsCommand({
      Bucket: this.config.bucket,
      Prefix: this.config.prefix,
      MaxKeys: this.config.maxKeys,
    })

    const resp = await this.client.send(cmd)
    // TODO: filter supported image format
    return resp.Contents?.map(convertToStorageObject) || []
  }
}
