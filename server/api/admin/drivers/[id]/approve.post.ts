import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { driverProfiles } from '../../../../infrastructure/db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }

  const db = useDb()
  const rows = await db.select({ id: driverProfiles.id, approvalStatus: driverProfiles.approvalStatus })
    .from(driverProfiles).where(eq(driverProfiles.id, id)).limit(1)
  const target = rows[0]
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  await db.update(driverProfiles).set({
    approvalStatus: 'approved',
    approvedAt: new Date(),
    approvedById: user.id,
    rejectionReason: null,
    isActive: true,
    status: 'active',
  }).where(eq(driverProfiles.id, id))

  return { ok: true, approvalStatus: 'approved' as const }
})
