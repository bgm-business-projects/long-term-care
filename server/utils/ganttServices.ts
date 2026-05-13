import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, user, careRecipients, organizations, driverProfiles, fleets, carpoolGroups } from '../infrastructure/db/schema'
import { eq, and, gte, lt, isNull, isNotNull, ne, inArray } from 'drizzle-orm'
import { listCarpoolsForDay } from './carpoolServices'

export function useGanttServices() {
  const db = useDb()
  return {
    getGanttData: async (date: string) => {
      // date: 'YYYY-MM-DD'
      const dayStart = new Date(`${date}T00:00:00+08:00`)
      const dayEnd = new Date(`${date}T23:59:59+08:00`)

      // 1. 取得所有已核准且啟用的司機（含車行 + 車輛）
      const driverRows = await db.select({
        userId: driverProfiles.userId,
        driverProfileId: driverProfiles.id,
        driverName: user.name,
        fleetId: driverProfiles.fleetId,
        fleetName: fleets.name,
        vehicleId: vehicles.id,
        plate: vehicles.plate,
        vehicleType: vehicles.vehicleType,
        seatCount: vehicles.seatCount,
        wheelchairCapacity: vehicles.wheelchairCapacity,
        isAccessible: vehicles.isAccessible,
        homeAddress: vehicles.homeAddress,
        homeLat: vehicles.homeLat,
        homeLng: vehicles.homeLng,
      })
      .from(driverProfiles)
      .innerJoin(user, eq(driverProfiles.userId, user.id))
      .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
      .leftJoin(vehicles, eq(vehicles.driverUserId, driverProfiles.userId))
      .where(
        and(
          eq(driverProfiles.approvalStatus, 'approved'),
          eq(driverProfiles.isActive, true),
        ),
      )

      // 2. 取得當日所有已指派 trips（有 driverUserId）
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
        originLat: trips.originLat,
        originLng: trips.originLng,
        destinationAddress: trips.destinationAddress,
        destinationLat: trips.destinationLat,
        destinationLng: trips.destinationLng,
        careRecipientName: careRecipients.name,
        driverName: user.name,
        carpoolGroupId: trips.carpoolGroupId,
        pairedTripId: trips.pairedTripId,
        tripDirection: trips.tripDirection,
      })
      .from(trips)
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .leftJoin(user, eq(trips.driverUserId, user.id))
      .where(
        and(
          isNotNull(trips.driverUserId),
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
          ne(trips.status, 'cancelled'),
        ),
      )

      // 2.5 取得當日共乘群組（含子 trips）
      const carpools = await listCarpoolsForDay(date)

      // 3. 當日未指派 trips（driverUserId IS NULL）
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
        pairedTripId: trips.pairedTripId,
        tripDirection: trips.tripDirection,
      })
      .from(trips)
      .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .leftJoin(organizations, eq(trips.organizationId, organizations.id))
      .where(
        and(
          isNull(trips.driverUserId),
          gte(trips.scheduledAt, dayStart),
          lt(trips.scheduledAt, dayEnd),
          ne(trips.status, 'cancelled'),
        ),
      )

      // 3.5 為「去程」trips 補上配對回程的 scheduledAt（可能跨日）
      const pairedIds = Array.from(new Set(
        [...assignedTrips, ...unassignedTrips]
          .filter(t => t.tripDirection === 'outbound' && t.pairedTripId)
          .map(t => t.pairedTripId as string),
      ))
      const pairedMap = new Map<string, string>()
      if (pairedIds.length > 0) {
        const pairedRows = await db.select({
          id: trips.id,
          scheduledAt: trips.scheduledAt,
        }).from(trips).where(inArray(trips.id, pairedIds))
        for (const p of pairedRows) {
          if (p.scheduledAt) pairedMap.set(p.id, p.scheduledAt.toISOString())
        }
      }
      const enrich = <T extends { tripDirection: string | null; pairedTripId: string | null }>(t: T) => ({
        ...t,
        pairedScheduledAt: t.tripDirection === 'outbound' && t.pairedTripId
          ? pairedMap.get(t.pairedTripId) ?? null
          : null,
      })
      const assignedTripsEnriched = assignedTrips.map(enrich)
      const unassignedTripsEnriched = unassignedTrips.map(enrich)

      // 4. 組合：每位司機一列，含其車輛、當日行程、共乘群組
      const drivers = driverRows.map(d => ({
        userId: d.userId,
        driverProfileId: d.driverProfileId,
        name: d.driverName,
        fleet: d.fleetName ? { id: d.fleetId, name: d.fleetName } : null,
        vehicle: d.vehicleId ? {
          id: d.vehicleId,
          plate: d.plate,
          vehicleType: d.vehicleType,
          seatCount: d.seatCount,
          wheelchairCapacity: d.wheelchairCapacity,
          isAccessible: d.isAccessible,
          homeAddress: d.homeAddress,
          homeLat: d.homeLat,
          homeLng: d.homeLng,
        } : null,
        // 個別 trips（含共乘子單，前端可選擇是否分開渲染）
        trips: assignedTripsEnriched.filter(t => t.driverUserId === d.userId),
        // 共乘群組：合併渲染用
        carpools: carpools.filter(c => c.driverUserId === d.userId),
      }))

      return { drivers, unassignedTrips: unassignedTripsEnriched }
    },
  }
}
