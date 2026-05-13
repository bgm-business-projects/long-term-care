import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { driverProfiles } from '../../../../infrastructure/db/schema'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }
  const dto = await parseBody(event, Schema)

  if (dto.status === 'rejected' && !dto.reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: '拒絕時必須填寫原因' })
  }

  const db = useDb()
  const rows = await db.select({ id: driverProfiles.id }).from(driverProfiles).where(eq(driverProfiles.id, id)).limit(1)
  if (!rows[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  const update: Record<string, unknown> = {
    approvalStatus: dto.status,
    approvedById: user.id,
  }

  if (dto.status === 'approved') {
    update.approvedAt = new Date()
    update.rejectionReason = null
    update.isActive = true
    update.status = 'active'
  } else if (dto.status === 'rejected') {
    update.approvedAt = null
    update.rejectionReason = dto.reason!.trim()
    update.isActive = false
  } else {
    // pending — 重新進入審核
    update.approvedAt = null
    update.rejectionReason = null
  }

  await db.update(driverProfiles).set(update).where(eq(driverProfiles.id, id))
  return { ok: true, approvalStatus: dto.status }
})
