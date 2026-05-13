import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { driverProfiles } from '../../../../infrastructure/db/schema'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  reason: z.string().min(1).max(500),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }
  const dto = await parseBody(event, Schema)

  const db = useDb()
  const rows = await db.select({ id: driverProfiles.id })
    .from(driverProfiles).where(eq(driverProfiles.id, id)).limit(1)
  if (rows.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  await db.update(driverProfiles).set({
    approvalStatus: 'rejected',
    rejectionReason: dto.reason,
    approvedAt: null,
    approvedById: user.id,
    isActive: false,
  }).where(eq(driverProfiles.id, id))

  return { ok: true, approvalStatus: 'rejected' as const }
})
