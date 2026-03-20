import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips, recurringSchedules } from '../../../infrastructure/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const orgId = (session.user as any).organizationId as string | null

  const body = await readBody(event)
  const { startDate, endDate } = body

  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required (YYYY-MM-DD)' })
  }

  const db = useDb()
  const { list, expandSchedule } = useRecurringScheduleServices()

  // 取得該機構所有啟用的排程
  const scheduleList = await list({ organizationId: orgId ?? undefined, activeOnly: true })

  if (scheduleList.length === 0) {
    return { created: 0, skipped: 0 }
  }

  // 查已存在該期間、有 recurringScheduleId 的訂單，用來去重
  const rangeStart = new Date(startDate + 'T00:00:00+08:00')
  const rangeEnd = new Date(endDate + 'T23:59:59+08:00')

  const existingTrips = await db
    .select({ recurringScheduleId: trips.recurringScheduleId, scheduledAt: trips.scheduledAt })
    .from(trips)
    .where(and(
      isNotNull(trips.recurringScheduleId),
      gte(trips.scheduledAt, rangeStart),
      lte(trips.scheduledAt, rangeEnd),
    ))

  // 建立去重 set: "scheduleId|YYYY-MM-DDTHH:mm"
  const existingKeys = new Set(
    existingTrips.map(t => `${t.recurringScheduleId}|${new Date(t.scheduledAt!).toISOString().slice(0, 16)}`)
  )

  let created = 0
  let skipped = 0

  for (const schedule of scheduleList) {
    const occurrences = await expandSchedule(schedule.id, startDate, endDate)

    for (const occ of occurrences) {
      const key = `${schedule.id}|${new Date(occ.scheduledAt).toISOString().slice(0, 16)}`
      if (existingKeys.has(key)) {
        skipped++
        continue
      }

      const scheduledAt = new Date(occ.scheduledAt)
      const scheduledEndAt = occ.scheduledEndAt ? new Date(occ.scheduledEndAt) : null

      await db.insert(trips).values({
        id: crypto.randomUUID(),
        careRecipientId: schedule.careRecipientId,
        organizationId: orgId ?? null,
        scheduledAt,
        scheduledEndAt,
        estimatedDuration: schedule.estimatedDuration ?? null,
        originAddress: schedule.originAddress,
        originLat: schedule.originLat ?? null,
        originLng: schedule.originLng ?? null,
        destinationAddress: schedule.destinationAddress,
        destinationLat: schedule.destinationLat ?? null,
        destinationLng: schedule.destinationLng ?? null,
        needsWheelchair: schedule.needsWheelchair,
        notes: schedule.notes ?? null,
        status: 'pending',
        recurringScheduleId: schedule.id,
      })

      existingKeys.add(key)
      created++
    }
  }

  setResponseStatus(event, 201)
  return { created, skipped }
})
