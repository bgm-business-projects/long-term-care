import { R2StorageService } from '../infrastructure/storage/R2StorageService'

let instance: R2StorageService | null = null

export function useStorageService(): R2StorageService {
  if (!instance) {
    const config = useRuntimeConfig()
    const { endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl } = config.r2
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw createError({ statusCode: 503, statusMessage: 'Storage service not configured: missing NUXT_R2_* environment variables' })
    }
    instance = new R2StorageService({ endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl })
  }
  return instance
}
