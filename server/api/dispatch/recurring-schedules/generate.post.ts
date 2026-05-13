import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips, recurringSchedules } from '../../../infrastructure/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const role = (session.user as any).role as string
  const sessionOrgId = (session.user as any).organizationId as string | null

  const body = await readBody(event)
  const { startDate, endDate } = body

  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required (YYYY-MM-DD)' })
  }

  // admin/developer 可指定 organizationId；agency_staff 強制用自己機構
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

  // 取得指定機構（或全部）所有啟用的排程
  const scheduleList = await list({
    organizationId: filterOrgId === null || filterOrgId === undefined ? undefined : filterOrgId,
    organizationIdIsNull: filterOrgId === null,
    activeOnly: true,
  })

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

    // 同一天的 outbound 與 return 兩個 occurrence 應該被 paired
    // 依日期分組
    const byDay = new Map<string, typeof occurrences>()
    for (const occ of occurrences) {
      const dayKey = new Date(occ.scheduledAt).toISOString().slice(0, 10)
      const arr = byDay.get(dayKey) ?? []
      arr.push(occ)
      byDay.set(dayKey, arr)
    }

    for (const [, dayOccs] of byDay) {
      // 同日 occurrences 按 scheduledAt 排序（outbound 在前、return 在後）
      dayOccs.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

      const insertedIds: { id: string; isReturn: boolean }[] = []
      for (const occ of dayOccs) {
        const key = `${schedule.id}|${new Date(occ.scheduledAt).toISOString().slice(0, 16)}`
        if (existingKeys.has(key)) {
          skipped++
          continue
        }
        const scheduledAt = new Date(occ.scheduledAt)
        const scheduledEndAt = occ.scheduledEndAt ? new Date(occ.scheduledEndAt) : null
        const id = crypto.randomUUID()
        await db.insert(trips).values({
          id,
          careRecipientId: schedule.careRecipientId,
          organizationId: schedule.organizationId ?? null,
          scheduledAt,
          scheduledEndAt,
          estimatedDuration: schedule.estimatedDuration ?? null,
          originAddress: occ.originAddress,
          originLat: occ.originLat ?? null,
          originLng: occ.originLng ?? null,
          destinationAddress: occ.destinationAddress,
          destinationLat: occ.destinationLat ?? null,
          destinationLng: occ.destinationLng ?? null,
          needsWheelchair: schedule.needsWheelchair,
          notes: occ.notes ?? null,
          status: 'pending',
          recurringScheduleId: schedule.id,
          tripDirection: occ.tripDirection,
        })
        existingKeys.add(key)
        created++
        insertedIds.push({ id, isReturn: !!occ.isReturn })
      }

      // 若同日有 outbound + return，互相 link
      const outbound = insertedIds.find(t => !t.isReturn)
      const ret = insertedIds.find(t => t.isReturn)
      if (outbound && ret) {
        await db.update(trips).set({ pairedTripId: ret.id }).where(eq(trips.id, outbound.id))
        await db.update(trips).set({ pairedTripId: outbound.id }).where(eq(trips.id, ret.id))
      }
    }
  }

  setResponseStatus(event, 201)
  return { created, skipped }
})
