import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, careRecipients, user } from '../infrastructure/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'

export function useReportServices() {
  const db = useDb()
  return {
    getMileageData: async (filter: {
      startDate: string
      endDate: string
      driverUserId?: string
      vehicleId?: string
      organizationId?: string
    }) => {
      const start = new Date(`${filter.startDate}T00:00:00+08:00`)
      const end = new Date(`${filter.endDate}T23:59:59+08:00`)

      const conditions = [
        gte(trips.scheduledAt, start),
        lt(trips.scheduledAt, end),
      ]

      if (filter.driverUserId) conditions.push(eq(trips.driverUserId, filter.driverUserId))
      if (filter.vehicleId) conditions.push(eq(trips.vehicleId, filter.vehicleId))
      if (filter.organizationId) conditions.push(eq(trips.organizationId, filter.organizationId))

      return db.select({
        tripDate: trips.scheduledAt,
        vehiclePlate: vehicles.plate,
        driverName: user.name,
        careRecipientName: careRecipients.name,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        mileageEstimated: trips.mileageEstimated,
        mileageActual: trips.mileageActual,
        status: trips.status,
        needsWheelchair: trips.needsWheelchair,
      })
      .from(trips)
      .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .leftJoin(user, eq(trips.driverUserId, user.id))
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .where(and(...conditions))
      .orderBy(trips.scheduledAt)
    },
  }
}
