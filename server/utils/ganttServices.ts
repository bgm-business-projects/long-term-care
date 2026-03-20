import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, user, careRecipients, organizations } from '../infrastructure/db/schema'
import { eq, and, gte, lt, isNull, isNotNull, ne } from 'drizzle-orm'

export function useGanttServices() {
  const db = useDb()
  return {
    getGanttData: async (date: string) => {
      // date: 'YYYY-MM-DD'
      const dayStart = new Date(`${date}T00:00:00+08:00`)
      const dayEnd = new Date(`${date}T23:59:59+08:00`)

      // 1. 取得所有啟用車輛
      const allVehicles = await db.query.vehicles.findMany({
        where: eq(vehicles.isActive, true),
        orderBy: vehicles.plate,
      })

      // 2. 取得當日所有已指派 trips（有 vehicleId）
      const assignedTrips = await db.select({
        id: trips.id,
        vehicleId: trips.vehicleId,
        driverUserId: trips.driverUserId,
        scheduledAt: trips.scheduledAt,
        scheduledEndAt: trips.scheduledEndAt,
        estimatedDuration: trips.estimatedDuration,
        status: trips.status,
        needsWheelchair: trips.needsWheelchair,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        careRecipientName: careRecipients.name,
        careRecipientSpecialNeeds: careRecipients.specialNeeds,
        driverName: user.name,
      })
      .from(trips)
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .leftJoin(user, eq(trips.driverUserId, user.id))
      .where(
        and(
          isNotNull(trips.vehicleId),
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
          ne(trips.status, 'cancelled'),
        )
      )

      // 3. 取得當日未指派 trips（vehicleId IS NULL）
      const unassignedTrips = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        estimatedDuration: trips.estimatedDuration,
        needsWheelchair: trips.needsWheelchair,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        careRecipientName: careRecipients.name,
        careRecipientId: trips.careRecipientId,
        organizationName: organizations.name,
      })
      .from(trips)
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .leftJoin(organizations, eq(trips.organizationId, organizations.id))
      .where(
        and(
          isNull(trips.vehicleId),
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
          ne(trips.status, 'cancelled'),
        )
      )

      // 4. 組合回傳結構
      const vehiclesWithTrips = allVehicles.map(v => ({
        ...v,
        trips: assignedTrips.filter(t => t.vehicleId === v.id),
      }))

      return { vehicles: vehiclesWithTrips, unassignedTrips }
    },
  }
}
