import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips } from '../../../infrastructure/db/schema'
import { and, gte, lte, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const role = (session.user as any).role as string
  const sessionOrgId = (session.user as any).organizationId as string | null

  const body = await readBody(event)
  const { startDate, endDate } = body

  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' })
  }

  // admin/developer 可指定 organizationId；agency_staff 強制用自己機構
  // 'all' = 全部機構, 'none' = 未指定機構, undefined/missing = 預設（admin 視為全部）
  let filterOrgId: string | null | undefined
  if (role === 'admin' || role === 'developer') {
    if (body.organizationId === 'none') filterOrgId = null
    else if (body.organizationId === 'all' || body.organizationId == null) filterOrgId = undefined
    else filterOrgId = body.organizationId as string
  } else {
    filterOrgId = sessionOrgId
  }

  const db = useDb()
  const { list, expandSchedule } = useRecurringScheduleServices()

  const scheduleList = await list({
    organizationId: filterOrgId === null || filterOrgId === undefined ? undefined : filterOrgId,
    organizationIdIsNull: filterOrgId === null,
    activeOnly: true,
  })

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
    isReturn: boolean
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
        isReturn: !!occ.isReturn,
      })
    }
  }

  occurrences.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  return occurrences
})
