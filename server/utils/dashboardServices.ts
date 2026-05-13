import { useDb } from '../infrastructure/db/drizzle'
import { trips, driverProfiles, user, careRecipients, vehicles, tripIncidents, organizations } from '../infrastructure/db/schema'
import { eq, and, gte, lte, count, sql, desc } from 'drizzle-orm'

export function useDashboardServices() {
  const db = useDb()
  return {
    getSummary: async (dateFrom: string, dateTo: string, organizationId?: string | null) => {
      const rangeStart = new Date(`${dateFrom}T00:00:00+08:00`)
      const rangeEnd = new Date(`${dateTo}T23:59:59+08:00`)
      const now = new Date()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // 機構過濾：agency_staff 限自己機構；admin 看全部
      const orgFilter = organizationId ? [eq(trips.organizationId, organizationId)] : []

      // 區間訂單總數
      const totalRows = await db.select({ total: count() }).from(trips)
        .where(and(gte(trips.scheduledAt, rangeStart), lte(trips.scheduledAt, rangeEnd), ...orgFilter))
      const total = totalRows[0]?.total ?? 0

      // 待派訂單
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
          gte(trips.scheduledAt, rangeStart),
          lte(trips.scheduledAt, rangeEnd),
          eq(trips.status, 'pending'),
          ...orgFilter,
        ))
        .orderBy(trips.scheduledAt)

      // 進行中 (in_progress) — 含預計抵達時間
      const driverUser2 = db.select().from(user).as('driver_user2')
      const activeTrips = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        scheduledEndAt: trips.scheduledEndAt,
        estimatedDuration: trips.estimatedDuration,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        careRecipientName: careRecipients.name,
        organizationName: organizations.name,
        driverName: driverUser2.name,
        driverPhone: driverProfiles.phone,
        vehiclePlate: vehicles.plate,
        vehicleType: vehicles.vehicleType,
      }).from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .leftJoin(organizations, eq(trips.organizationId, organizations.id))
        .leftJoin(driverUser2, eq(trips.driverUserId, driverUser2.id))
        .leftJoin(driverProfiles, eq(trips.driverUserId, driverProfiles.userId))
        .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
        .where(and(
          eq(trips.status, 'in_progress'),
          gte(trips.scheduledAt, rangeStart),
          lte(trips.scheduledAt, rangeEnd),
          ...orgFilter,
        ))
        .orderBy(trips.scheduledAt)

      // 延遲未出發
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
          lte(trips.scheduledAt, now),
          gte(trips.scheduledAt, rangeStart),
          ...orgFilter,
        ))

      // 駕照即將到期 — agency_staff 不負責司機證照，僅 admin 看得到
      const licenseExpiring = organizationId
        ? []
        : await db.select({
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

      // 異常回報（區間內）
      const incidentRows = await db.select({
        id: tripIncidents.id,
        tripId: tripIncidents.tripId,
        type: tripIncidents.type,
        description: tripIncidents.description,
        reportedAt: tripIncidents.reportedAt,
        resolved: tripIncidents.resolved,
        resolvedAt: tripIncidents.resolvedAt,
        driverName: user.name,
        careRecipientName: careRecipients.name,
        tripScheduledAt: trips.scheduledAt,
      })
      .from(tripIncidents)
      .leftJoin(trips, eq(tripIncidents.tripId, trips.id))
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .leftJoin(user, eq(tripIncidents.driverUserId, user.id))
      .where(and(
        gte(tripIncidents.reportedAt, rangeStart),
        lte(tripIncidents.reportedAt, rangeEnd),
        ...orgFilter,
      ))
      .orderBy(desc(tripIncidents.reportedAt))

      return {
        totalTripCount: Number(total),
        pendingTripCount: pendingTrips.length,
        activeTripCount: activeTrips.length,
        pendingTrips,
        activeTrips,
        incidents: incidentRows,
        unresolvedIncidentCount: incidentRows.filter(i => !i.resolved).length,
        alerts: {
          delayedDepartures: delayed,
          licenseExpiringSoon: licenseExpiring,
        },
      }
    },
  }
}
