import { useDb } from '../infrastructure/db/drizzle'
import { recurringSchedules, careRecipients } from '../infrastructure/db/schema'
import { eq, and } from 'drizzle-orm'

export interface RecurringScheduleCreateData {
  careRecipientId: string
  organizationId?: string
  daysOfWeek: number[]
  departureTime: string
  originAddress: string
  originLat?: string
  originLng?: string
  destinationAddress: string
  destinationLat?: string
  destinationLng?: string
  needsWheelchair?: boolean
  notes?: string
  effectiveStartDate?: string
  effectiveEndDate?: string
  estimatedDuration?: number
}

export interface RecurringScheduleUpdateData {
  daysOfWeek?: number[]
  departureTime?: string
  originAddress?: string
  originLat?: string
  originLng?: string
  destinationAddress?: string
  destinationLat?: string
  destinationLng?: string
  needsWheelchair?: boolean
  isActive?: boolean
  notes?: string
  effectiveStartDate?: string
  effectiveEndDate?: string
  estimatedDuration?: number
}

export function useRecurringScheduleServices() {
  const db = useDb()

  const list = async (filter: {
    careRecipientId?: string
    organizationId?: string
    activeOnly?: boolean
  }) => {
    const conditions = []

    if (filter.careRecipientId) {
      conditions.push(eq(recurringSchedules.careRecipientId, filter.careRecipientId))
    }
    if (filter.organizationId) {
      conditions.push(eq(recurringSchedules.organizationId, filter.organizationId))
    }
    if (filter.activeOnly) {
      conditions.push(eq(recurringSchedules.isActive, true))
    }

    return db
      .select({
        id: recurringSchedules.id,
        careRecipientId: recurringSchedules.careRecipientId,
        careRecipientName: careRecipients.name,
        organizationId: recurringSchedules.organizationId,
        daysOfWeek: recurringSchedules.daysOfWeek,
        departureTime: recurringSchedules.departureTime,
        originAddress: recurringSchedules.originAddress,
        originLat: recurringSchedules.originLat,
        originLng: recurringSchedules.originLng,
        destinationAddress: recurringSchedules.destinationAddress,
        destinationLat: recurringSchedules.destinationLat,
        destinationLng: recurringSchedules.destinationLng,
        needsWheelchair: recurringSchedules.needsWheelchair,
        isActive: recurringSchedules.isActive,
        notes: recurringSchedules.notes,
        effectiveStartDate: recurringSchedules.effectiveStartDate,
        effectiveEndDate: recurringSchedules.effectiveEndDate,
        estimatedDuration: recurringSchedules.estimatedDuration,
        createdAt: recurringSchedules.createdAt,
        updatedAt: recurringSchedules.updatedAt,
      })
      .from(recurringSchedules)
      .leftJoin(careRecipients, eq(recurringSchedules.careRecipientId, careRecipients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
  }

  const getById = async (id: string) => {
    const rows = await db
      .select({
        id: recurringSchedules.id,
        careRecipientId: recurringSchedules.careRecipientId,
        careRecipientName: careRecipients.name,
        organizationId: recurringSchedules.organizationId,
        daysOfWeek: recurringSchedules.daysOfWeek,
        departureTime: recurringSchedules.departureTime,
        originAddress: recurringSchedules.originAddress,
        originLat: recurringSchedules.originLat,
        originLng: recurringSchedules.originLng,
        destinationAddress: recurringSchedules.destinationAddress,
        destinationLat: recurringSchedules.destinationLat,
        destinationLng: recurringSchedules.destinationLng,
        needsWheelchair: recurringSchedules.needsWheelchair,
        isActive: recurringSchedules.isActive,
        notes: recurringSchedules.notes,
        effectiveStartDate: recurringSchedules.effectiveStartDate,
        effectiveEndDate: recurringSchedules.effectiveEndDate,
        estimatedDuration: recurringSchedules.estimatedDuration,
        createdAt: recurringSchedules.createdAt,
        updatedAt: recurringSchedules.updatedAt,
      })
      .from(recurringSchedules)
      .leftJoin(careRecipients, eq(recurringSchedules.careRecipientId, careRecipients.id))
      .where(eq(recurringSchedules.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  const create = async (data: RecurringScheduleCreateData) => {
    const inserted = await db
      .insert(recurringSchedules)
      .values({
        careRecipientId: data.careRecipientId,
        organizationId: data.organizationId ?? null,
        daysOfWeek: JSON.stringify(data.daysOfWeek),
        departureTime: data.departureTime,
        originAddress: data.originAddress,
        originLat: data.originLat ?? null,
        originLng: data.originLng ?? null,
        destinationAddress: data.destinationAddress,
        destinationLat: data.destinationLat ?? null,
        destinationLng: data.destinationLng ?? null,
        needsWheelchair: data.needsWheelchair ?? false,
        notes: data.notes ?? null,
        effectiveStartDate: data.effectiveStartDate ?? null,
        effectiveEndDate: data.effectiveEndDate ?? null,
        estimatedDuration: data.estimatedDuration ?? null,
        isActive: true,
      })
      .returning()

    return inserted[0]
  }

  const update = async (id: string, data: RecurringScheduleUpdateData) => {
    type DbUpdate = {
      daysOfWeek?: string
      departureTime?: string
      originAddress?: string
      originLat?: string | null
      originLng?: string | null
      destinationAddress?: string
      destinationLat?: string | null
      destinationLng?: string | null
      needsWheelchair?: boolean
      isActive?: boolean
      notes?: string | null
      effectiveStartDate?: string | null
      effectiveEndDate?: string | null
      estimatedDuration?: number | null
    }

    const updateValues: DbUpdate = {}
    if (data.daysOfWeek !== undefined) updateValues.daysOfWeek = JSON.stringify(data.daysOfWeek)
    if (data.departureTime !== undefined) updateValues.departureTime = data.departureTime
    if (data.originAddress !== undefined) updateValues.originAddress = data.originAddress
    if (data.originLat !== undefined) updateValues.originLat = data.originLat
    if (data.originLng !== undefined) updateValues.originLng = data.originLng
    if (data.destinationAddress !== undefined) updateValues.destinationAddress = data.destinationAddress
    if (data.destinationLat !== undefined) updateValues.destinationLat = data.destinationLat
    if (data.destinationLng !== undefined) updateValues.destinationLng = data.destinationLng
    if (data.needsWheelchair !== undefined) updateValues.needsWheelchair = data.needsWheelchair
    if (data.isActive !== undefined) updateValues.isActive = data.isActive
    if (data.notes !== undefined) updateValues.notes = data.notes
    if (data.effectiveStartDate !== undefined) updateValues.effectiveStartDate = data.effectiveStartDate
    if (data.effectiveEndDate !== undefined) updateValues.effectiveEndDate = data.effectiveEndDate
    if (data.estimatedDuration !== undefined) updateValues.estimatedDuration = data.estimatedDuration

    if (Object.keys(updateValues).length === 0) {
      return getById(id)
    }

    const updated = await db
      .update(recurringSchedules)
      .set(updateValues)
      .where(eq(recurringSchedules.id, id))
      .returning()

    return updated[0] ?? null
  }

  const deactivate = async (id: string) => {
    await db
      .update(recurringSchedules)
      .set({ isActive: false })
      .where(eq(recurringSchedules.id, id))
  }

  const expandSchedule = async (id: string, startDate: string, endDate: string) => {
    const schedule = await getById(id)
    if (!schedule) throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })

    const weekdays: number[] = JSON.parse(schedule.daysOfWeek) // [1,3,5]
    const start = new Date(startDate + 'T00:00:00+08:00')
    const end = new Date(endDate + 'T23:59:59+08:00')

    // effectiveStartDate/effectiveEndDate 限制範圍
    const effectiveStart = schedule.effectiveStartDate
      ? new Date(schedule.effectiveStartDate + 'T00:00:00+08:00')
      : start
    const effectiveEnd = schedule.effectiveEndDate
      ? new Date(schedule.effectiveEndDate + 'T23:59:59+08:00')
      : end

    const rangeStart = effectiveStart > start ? effectiveStart : start
    const rangeEnd = effectiveEnd < end ? effectiveEnd : end

    const occurrences = []
    const cursor = new Date(rangeStart)

    while (cursor <= rangeEnd) {
      const dayOfWeek = cursor.getDay() // 0=日,1=一...6=六
      // 轉換：weekdays 存的是 1=週一...7=週日（ISO weekday）
      // cursor.getDay(): 0=週日→7, 1=週一→1...6=週六→6
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek

      if (weekdays.includes(isoDay)) {
        const [h, m] = schedule.departureTime.split(':').map(Number)
        const scheduledAt = new Date(cursor)
        scheduledAt.setHours(h, m, 0, 0)

        occurrences.push({
          scheduleId: id,
          scheduledAt: scheduledAt.toISOString(),
          scheduledEndAt: schedule.estimatedDuration
            ? new Date(scheduledAt.getTime() + schedule.estimatedDuration * 60000).toISOString()
            : null,
          estimatedDuration: schedule.estimatedDuration,
          originAddress: schedule.originAddress,
          originLat: schedule.originLat,
          originLng: schedule.originLng,
          destinationAddress: schedule.destinationAddress,
          destinationLat: schedule.destinationLat,
          destinationLng: schedule.destinationLng,
          needsWheelchair: schedule.needsWheelchair,
          careRecipientId: schedule.careRecipientId,
          organizationId: schedule.organizationId,
          notes: schedule.notes,
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return occurrences
  }

  return { list, getById, create, update, deactivate, expandSchedule }
}
