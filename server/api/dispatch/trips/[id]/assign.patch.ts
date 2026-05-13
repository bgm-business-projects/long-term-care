import { requireAdmin } from '../../../../utils/requireAdmin'
import { useConflictCheckServices } from '../../../../utils/conflictCheckServices'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { trips, vehicles } from '../../../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { driverUserId, scheduledAt, scheduledEndAt } = body

  if (!driverUserId) throw createError({ statusCode: 400, statusMessage: 'driverUserId 必填' })

  const db = useDb()

  // 司機=車 1:1 — 從 driverUserId 取得車輛
  const vRow = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.driverUserId, driverUserId)).limit(1)
  const vehicleId = vRow[0]?.id ?? null

  // 衝突檢核（用車輛 id 檢查時段衝突）
  if (vehicleId && scheduledAt && scheduledEndAt) {
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

  const [updated] = await db.update(trips)
    .set({
      vehicleId,
      driverUserId,
      status: 'assigned',
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(scheduledEndAt && { scheduledEndAt: new Date(scheduledEndAt) }),
    })
    .where(eq(trips.id, id))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: '行程不存在' })

  // 來回配對：若此單有 pairedTripId 且配對方尚未指派 → 同步指派同司機/同車
  if (updated.pairedTripId) {
    const paired = await db.select({
      id: trips.id,
      driverUserId: trips.driverUserId,
      status: trips.status,
    }).from(trips).where(eq(trips.id, updated.pairedTripId)).limit(1)
    if (paired[0] && !paired[0].driverUserId) {
      await db.update(trips)
        .set({ vehicleId, driverUserId, status: 'assigned' })
        .where(eq(trips.id, paired[0].id))
    }
  }

  return updated
})
