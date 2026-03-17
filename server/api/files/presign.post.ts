import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { requireAuth } from '../../utils/requireAuth'
import { useStorageService } from '../../utils/storageService'
import { PresignRequestSchema } from '../../shared/contracts/file.dto'
import { parseBody } from '../../shared/contracts/validation'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const dto = await parseBody(event, PresignRequestSchema)

  const ext = extname(dto.filename) || mimeToExt(dto.contentType)
  const key = `${user.id}/${randomUUID()}${ext}`

  const storage = useStorageService()
  return storage.generatePresignedUploadUrl(key, dto.contentType)
})

function mimeToExt(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
  }
  return map[contentType] ?? '.bin'
}
