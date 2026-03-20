import { requireAdmin } from '../../../../utils/requireAdmin'
import { useConflictCheckServices } from '../../../../utils/conflictCheckServices'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { trips } from '../../../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { vehicleId, driverUserId, scheduledAt, scheduledEndAt } = body

  if (!vehicleId) throw createError({ statusCode: 400, statusMessage: 'vehicleId 必填' })

  // 衝突檢核
  if (scheduledAt && scheduledEndAt) {
    const { check } = useConflictCheckServices()
    const result = await check({
      vehicleId,
      scheduledAt: new Date(scheduledAt),
      scheduledEndAt: new Date(scheduledEndAt),
      excludeTripId: id,
    })
    if (result.hasConflict) {
      throw createError({
        statusCode: 409,
        statusMessage: '資源衝突',
        data: result,
      })
    }
  }

  const db = useDb()
  const [updated] = await db.update(trips)
    .set({
      vehicleId,
      driverUserId: driverUserId || null,
      status: 'assigned',
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(scheduledEndAt && { scheduledEndAt: new Date(scheduledEndAt) }),
    })
    .where(eq(trips.id, id))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: '行程不存在' })
  return updated
})
