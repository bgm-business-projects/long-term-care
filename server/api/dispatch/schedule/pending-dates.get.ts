import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips } from '../../../infrastructure/db/schema'
import { and, isNull, isNotNull, gte, lt, ne, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const db = useDb()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const endDate = new Date(todayStart)
  endDate.setDate(endDate.getDate() + 60)

  const dateExpr = sql<string>`TO_CHAR(${trips.scheduledAt} AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD')`
  const baseWhere = and(
    gte(trips.scheduledAt, todayStart),
    lt(trips.scheduledAt, endDate),
    ne(trips.status, 'cancelled'),
    ne(trips.status, 'completed'),
  )

  // 待派車輛：vehicleId IS NULL
  const noVehicleRows = await db
    .select({ date: dateExpr, count: sql<number>`COUNT(*)::int` })
    .from(trips)
    .where(and(baseWhere, isNull(trips.vehicleId)))
    .groupBy(dateExpr)

  // 待排司機：有車輛但無司機
  const noDriverRows = await db
    .select({ date: dateExpr, count: sql<number>`COUNT(*)::int` })
    .from(trips)
    .where(and(baseWhere, isNotNull(trips.vehicleId), isNull(trips.driverUserId)))
    .groupBy(dateExpr)

  // 合併成 { date, noVehicle, noDriver }
  const dateMap = new Map<string, { noVehicle: number; noDriver: number }>()

  for (const row of noVehicleRows) {
    dateMap.set(row.date, { noVehicle: row.count, noDriver: 0 })
  }
  for (const row of noDriverRows) {
    const existing = dateMap.get(row.date)
    if (existing) {
      existing.noDriver = row.count
    } else {
      dateMap.set(row.date, { noVehicle: 0, noDriver: row.count })
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))
})
