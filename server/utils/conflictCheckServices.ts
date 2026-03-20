import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles } from '../infrastructure/db/schema'
import { eq, and, lt, gt, ne } from 'drizzle-orm'

export function useConflictCheckServices() {
  const db = useDb()
  return {
    check: async (params: {
      vehicleId: string
      scheduledAt: Date
      scheduledEndAt: Date
      excludeTripId?: string
    }) => {
      const { vehicleId, scheduledAt, scheduledEndAt, excludeTripId } = params

      // 查詢車輛資料
      const vehicle = await db.query.vehicles.findFirst({
        where: eq(vehicles.id, vehicleId),
      })
      if (!vehicle) throw createError({ statusCode: 404, statusMessage: '車輛不存在' })

      // 查詢時間重疊的 trips（排除已取消）
      const conditions: ReturnType<typeof eq>[] = [
        eq(trips.vehicleId, vehicleId),
        lt(trips.scheduledAt, scheduledEndAt),   // 現有行程在新行程結束前開始
        gt(trips.scheduledEndAt, scheduledAt),   // 現有行程在新行程開始後結束
        ne(trips.status, 'cancelled'),
      ]
      if (excludeTripId) conditions.push(ne(trips.id, excludeTripId))

      const overlapping = await db.select().from(trips).where(and(...conditions))

      const conflicts: Array<{
        type: 'time_overlap' | 'wheelchair_capacity'
        conflictingTripIds: string[]
        detail: string
      }> = []

      // 時間重疊衝突
      if (overlapping.length > 0) {
        conflicts.push({
          type: 'time_overlap',
          conflictingTripIds: overlapping.map(t => t.id),
          detail: `與 ${overlapping.length} 筆行程時間重疊`,
        })
      }

      return {
        hasConflict: conflicts.length > 0,
        conflicts,
        vehicle: { plate: vehicle.plate, wheelchairCapacity: vehicle.wheelchairCapacity },
      }
    },
  }
}
