import { z } from 'zod/v4'

export const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]),
})

export type PresignRequestDTO = z.infer<typeof PresignRequestSchema>

export const PresignBatchResponseSchema = z.object({
  basePublicUrl: z.string(),
  variants: z.object({
    sm: z.object({ uploadUrl: z.string() }),
    md: z.object({ uploadUrl: z.string() }),
    lg: z.object({ uploadUrl: z.string() }),
  }),
})
export type PresignBatchResponseDTO = z.infer<typeof PresignBatchResponseSchema>
