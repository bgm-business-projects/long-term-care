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
  const uuid = randomUUID()
  const basePath = `${user.id}/${uuid}`

  const storage = useStorageService()

  const [lg, md, sm] = await Promise.all([
    storage.generatePresignedUploadUrl(`${basePath}${ext}`, dto.contentType),
    storage.generatePresignedUploadUrl(`${basePath}__md${ext}`, dto.contentType),
    storage.generatePresignedUploadUrl(`${basePath}__sm${ext}`, dto.contentType),
  ])

  return {
    basePublicUrl: lg.publicUrl,
    variants: {
      sm: { uploadUrl: sm.uploadUrl },
      md: { uploadUrl: md.uploadUrl },
      lg: { uploadUrl: lg.uploadUrl },
    },
  }
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
