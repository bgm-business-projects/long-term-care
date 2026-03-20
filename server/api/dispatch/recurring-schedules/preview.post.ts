import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips } from '../../../infrastructure/db/schema'
import { and, gte, lte, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const orgId = (session.user as any).organizationId as string | null

  const body = await readBody(event)
  const { startDate, endDate } = body

  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' })
  }

  const db = useDb()
  const { list, expandSchedule } = useRecurringScheduleServices()

  const scheduleList = await list({ organizationId: orgId ?? undefined, activeOnly: true })

  // 已存在訂單的 key set
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

  const existingKeys = new Set(
    existingTrips.map(t => `${t.recurringScheduleId}|${new Date(t.scheduledAt!).toISOString().slice(0, 16)}`)
  )

  // 展開所有排程並標記是否已存在
  const occurrences: {
    scheduleId: string
    careRecipientId: string
    careRecipientName: string
    scheduledAt: string
    originAddress: string
    destinationAddress: string
    needsWheelchair: boolean
    notes: string | null
    exists: boolean
  }[] = []

  for (const schedule of scheduleList) {
    const expanded = await expandSchedule(schedule.id, startDate, endDate)
    for (const occ of expanded) {
      const key = `${schedule.id}|${new Date(occ.scheduledAt).toISOString().slice(0, 16)}`
      occurrences.push({
        scheduleId: schedule.id,
        careRecipientId: schedule.careRecipientId,
        careRecipientName: schedule.careRecipientName ?? schedule.careRecipientId,
        scheduledAt: occ.scheduledAt,
        originAddress: occ.originAddress,
        destinationAddress: occ.destinationAddress,
        needsWheelchair: occ.needsWheelchair,
        notes: occ.notes ?? null,
        exists: existingKeys.has(key),
      })
    }
  }

  occurrences.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  return occurrences
})
