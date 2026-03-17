import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

interface StorageConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

export class R2StorageService {
  private client: S3Client
  private bucketName: string
  private publicUrl: string

  constructor(config: StorageConfig) {
    const missing = (['endpoint', 'accessKeyId', 'secretAccessKey', 'bucketName', 'publicUrl'] as const)
      .filter(key => !config[key])
    if (missing.length > 0) {
      throw new Error(`R2StorageService: missing required config: ${missing.map(k => `NUXT_R2_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', ')}`)
    }

    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: config.endpoint,
      forcePathStyle: true, // required for MinIO
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    this.bucketName = config.bucketName
    this.publicUrl = config.publicUrl.replace(/\/$/, '')
  }

  async generatePresignedUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=2592000, immutable',
    })

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 })

    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
    }
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })
    await this.client.send(command)
  }

  extractKeyFromUrl(url: string): string | null {
    if (!url.startsWith(this.publicUrl)) return null
    return url.slice(this.publicUrl.length + 1)
  }
}
