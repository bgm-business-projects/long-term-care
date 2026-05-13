import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, careRecipients, user, organizations, carpoolGroups } from '../infrastructure/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

export interface ReportFilter {
  startDate: string
  endDate: string
  driverUserId?: string
  vehicleId?: string
  organizationId?: string
  careRecipientId?: string
}

function dateRange(filter: ReportFilter): { start: Date; end: Date } {
  return {
    start: new Date(`${filter.startDate}T00:00:00+08:00`),
    end: new Date(`${filter.endDate}T23:59:59+08:00`),
  }
}

export function useReportServices() {
  const db = useDb()
  return {
    /**
     * 個案接送報表：以個案視角列出每筆接送
     * 同一個案的去程 / 回程會用 direction 區分；若有 pairedTripId 也帶上配對時間
     */
    getRecipientReport: async (filter: ReportFilter) => {
      const { start, end } = dateRange(filter)
      const conditions = [gte(trips.scheduledAt, start), lte(trips.scheduledAt, end)]
      if (filter.organizationId) conditions.push(eq(trips.organizationId, filter.organizationId))
      if (filter.careRecipientId) conditions.push(eq(trips.careRecipientId, filter.careRecipientId))
      if (filter.driverUserId) conditions.push(eq(trips.driverUserId, filter.driverUserId))

      const rows = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        scheduledEndAt: trips.scheduledEndAt,
        originAddress: trips.originAddress,
        originLat: trips.originLat,
        originLng: trips.originLng,
        destinationAddress: trips.destinationAddress,
        destinationLat: trips.destinationLat,
        destinationLng: trips.destinationLng,
        status: trips.status,
        needsWheelchair: trips.needsWheelchair,
        mileageEstimated: trips.mileageEstimated,
        mileageActual: trips.mileageActual,
        tripDirection: trips.tripDirection,
        pairedTripId: trips.pairedTripId,
        careRecipientName: careRecipients.name,
        organizationName: organizations.name,
        driverName: user.name,
        vehiclePlate: vehicles.plate,
      })
        .from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .leftJoin(organizations, eq(trips.organizationId, organizations.id))
        .leftJoin(user, eq(trips.driverUserId, user.id))
        .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
        .where(and(...conditions))
        .orderBy(careRecipients.name, trips.scheduledAt)

      // 補上配對 trip 的時間（去程顯示回程時間、反之亦然）
      const pairedIds = Array.from(new Set(rows.filter(r => r.pairedTripId).map(r => r.pairedTripId!)))
      const pairedMap = new Map<string, Date>()
      if (pairedIds.length > 0) {
        const paired = await db.select({ id: trips.id, scheduledAt: trips.scheduledAt })
          .from(trips).where(inArray(trips.id, pairedIds))
        for (const p of paired) if (p.scheduledAt) pairedMap.set(p.id, p.scheduledAt)
      }

      return rows.map(r => ({
        ...r,
        directionLabel: r.tripDirection === 'outbound' ? '去程'
          : r.tripDirection === 'return' ? '回程' : '單程',
        pairedScheduledAt: r.pairedTripId ? pairedMap.get(r.pairedTripId) ?? null : null,
      }))
    },

    /**
     * 司機出勤報表：以司機 + 日期分組，列出當日所有行程（含共乘明細）
     */
    getDriverAttendanceReport: async (filter: ReportFilter) => {
      const { start, end } = dateRange(filter)
      const conditions = [gte(trips.scheduledAt, start), lte(trips.scheduledAt, end)]
      if (filter.driverUserId) conditions.push(eq(trips.driverUserId, filter.driverUserId))
      if (filter.vehicleId) conditions.push(eq(trips.vehicleId, filter.vehicleId))

      const rows = await db.select({
        id: trips.id,
        scheduledAt: trips.scheduledAt,
        scheduledEndAt: trips.scheduledEndAt,
        originAddress: trips.originAddress,
        destinationAddress: trips.destinationAddress,
        status: trips.status,
        needsWheelchair: trips.needsWheelchair,
        mileageEstimated: trips.mileageEstimated,
        mileageActual: trips.mileageActual,
        tripDirection: trips.tripDirection,
        carpoolGroupId: trips.carpoolGroupId,
        carpoolOrder: trips.carpoolOrder,
        carpoolPickupAt: trips.carpoolPickupAt,
        carpoolDropoffOrder: trips.carpoolDropoffOrder,
        carpoolDropoffAt: trips.carpoolDropoffAt,
        careRecipientName: careRecipients.name,
        driverUserId: trips.driverUserId,
        driverName: user.name,
        vehiclePlate: vehicles.plate,
      })
        .from(trips)
        .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
        .leftJoin(user, eq(trips.driverUserId, user.id))
        .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
        .where(and(...conditions))
        .orderBy(user.name, trips.scheduledAt)

      // 共乘群組總覽（人數、總距離）
      const groupIds = Array.from(new Set(rows.filter(r => r.carpoolGroupId).map(r => r.carpoolGroupId!)))
      const groupMap = new Map<string, { size: number; totalDistance: number | null; totalMinutes: number | null }>()
      if (groupIds.length > 0) {
        const groups = await db.select({
          id: carpoolGroups.id,
          totalDistanceMeters: carpoolGroups.totalDistanceMeters,
          totalDurationMinutes: carpoolGroups.totalDurationMinutes,
        }).from(carpoolGroups).where(inArray(carpoolGroups.id, groupIds))
        const sizeByGroup = rows.reduce<Record<string, number>>((acc, r) => {
          if (r.carpoolGroupId) acc[r.carpoolGroupId] = (acc[r.carpoolGroupId] ?? 0) + 1
          return acc
        }, {})
        for (const g of groups) {
          groupMap.set(g.id, {
            size: sizeByGroup[g.id] ?? 0,
            totalDistance: g.totalDistanceMeters,
            totalMinutes: g.totalDurationMinutes,
          })
        }
      }

      // 加上「當日序號」：同司機同日按時間排序的第幾趟
      const dailyCounter: Record<string, number> = {}
      return rows.map(r => {
        const day = r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('zh-TW') : ''
        const key = `${r.driverUserId ?? 'none'}|${day}`
        dailyCounter[key] = (dailyCounter[key] ?? 0) + 1
        const groupInfo = r.carpoolGroupId ? groupMap.get(r.carpoolGroupId) ?? null : null
        return {
          ...r,
          directionLabel: r.tripDirection === 'outbound' ? '去程'
            : r.tripDirection === 'return' ? '回程' : '單程',
          dailySeq: dailyCounter[key],
          carpoolSize: groupInfo?.size ?? null,
          carpoolTotalDistanceMeters: groupInfo?.totalDistance ?? null,
          carpoolTotalDurationMinutes: groupInfo?.totalMinutes ?? null,
        }
      })
    },
  }
}
