import { useDb } from '../infrastructure/db/drizzle'
import { trips, driverProfiles, user, careRecipients, vehicles } from '../infrastructure/db/schema'
import { eq, and, gte, lt, count, sql } from 'drizzle-orm'

export function useDashboardServices() {
  const db = useDb()
  return {
    getSummary: async (date: string) => {
      const dayStart = new Date(`${date}T00:00:00+08:00`)
      const dayEnd = new Date(`${date}T23:59:59+08:00`)
      const now = new Date()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // 今日訂單總數
      const [{ total }] = await db.select({ total: count() }).from(trips)
        .where(and(gte(trips.scheduledAt, dayStart), lt(trips.scheduledAt, dayEnd)))

      // 待派訂單（含個案資訊）
      const pendingTrips = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        needsWheelchair: trips.needsWheelchair,
        notes: trips.notes,
        careRecipientName: careRecipients.name,
        careRecipientPhone: careRecipients.contactPhone,
      }).from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .where(and(
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
          eq(trips.status, 'pending'),
        ))
        .orderBy(trips.scheduledAt)

      // 執行中車輛（含司機與個案資訊）
      const driverUser2 = db.select().from(user).as('driver_user2')
      const activeVehicleTrips = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        careRecipientName: careRecipients.name,
        driverName: driverUser2.name,
        driverPhone: driverProfiles.phone,
        vehiclePlate: vehicles.plate,
        vehicleType: vehicles.vehicleType,
      }).from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .leftJoin(driverUser2, eq(trips.driverUserId, driverUser2.id))
        .leftJoin(driverProfiles, eq(trips.driverUserId, driverProfiles.userId))
        .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
        .where(and(
          eq(trips.status, 'in_progress'),
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
        ))
        .orderBy(trips.scheduledAt)

      // 異常告警：已派但超過出發時間未動的
      const driverUser = db.select().from(user).as('driver_user')
      const delayed = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        needsWheelchair: trips.needsWheelchair,
        notes: trips.notes,
        careRecipientName: careRecipients.name,
        careRecipientPhone: careRecipients.contactPhone,
        driverName: driverUser.name,
        driverPhone: driverProfiles.phone,
        vehiclePlate: vehicles.plate,
        vehicleType: vehicles.vehicleType,
      }).from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .leftJoin(driverUser, eq(trips.driverUserId, driverUser.id))
        .leftJoin(driverProfiles, eq(trips.driverUserId, driverProfiles.userId))
        .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
        .where(and(
          eq(trips.status, 'assigned'),
          lt(trips.scheduledAt, now),
          gte(trips.scheduledAt, dayStart),
        ))

      // 駕照 30 天內到期的司機
      const licenseExpiring = await db.select({
        id: driverProfiles.id,
        phone: driverProfiles.phone,
        licenseExpiry: driverProfiles.licenseExpiry,
        name: user.name,
      })
      .from(driverProfiles)
      .leftJoin(user, eq(driverProfiles.userId, user.id))
      .where(and(
        eq(driverProfiles.isActive, true),
        sql`${driverProfiles.licenseExpiry} IS NOT NULL`,
        sql`${driverProfiles.licenseExpiry} <= ${in30Days.toISOString().split('T')[0]}`,
        sql`${driverProfiles.licenseExpiry} >= ${now.toISOString().split('T')[0]}`,
      ))

      return {
        todayTripCount: Number(total),
        pendingTripCount: pendingTrips.length,
        activeVehicleCount: new Set(activeVehicleTrips.map(t => t.vehiclePlate).filter(Boolean)).size,
        pendingTrips,
        activeVehicleTrips,
        alerts: {
          delayedDepartures: delayed,
          licenseExpiringSoon: licenseExpiring,
        },
      }
    },
  }
}
