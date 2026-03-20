import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDb } from '../../../infrastructure/db/drizzle'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const db = useDb()

  // 取得今日 in_progress 或 assigned 的行程，以及其最後一筆打卡位置
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 子查詢：每個 trip 的最後一筆 status log（有 GPS）
  const positions = await db.execute(sql`
    SELECT DISTINCT ON (t.vehicle_id)
      t.id as trip_id,
      t.vehicle_id,
      v.plate,
      u.name as driver_name,
      tsl.lat,
      tsl.lng,
      tsl.timestamp as last_update,
      tsl.status as last_status,
      t.status as trip_status
    FROM trips t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN "user" u ON t.driver_user_id = u.id
    LEFT JOIN trip_status_logs tsl ON tsl.trip_id = t.id AND tsl.lat IS NOT NULL
    WHERE
      t.vehicle_id IS NOT NULL
      AND t.status IN ('assigned', 'in_progress')
      AND DATE(t.scheduled_at AT TIME ZONE 'Asia/Taipei') = ${todayStr}
    ORDER BY t.vehicle_id, tsl.timestamp DESC
  `)

  return (positions as any[]).filter((p: any) => p.lat && p.lng)
})
