import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Schedule ID required' })
  }

  const body = await readBody(event)
  const { getById, update } = useRecurringScheduleServices()

  const existing = await getById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
  }

  const updated = await update(id, {
    daysOfWeek: body.daysOfWeek,
    departureTime: body.departureTime,
    originAddress: body.originAddress,
    originLat: body.originLat,
    originLng: body.originLng,
    destinationAddress: body.destinationAddress,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
    needsWheelchair: body.needsWheelchair,
    isActive: body.isActive,
    notes: body.notes,
    effectiveStartDate: body.effectiveStartDate,
    effectiveEndDate: body.effectiveEndDate,
    estimatedDuration: body.estimatedDuration,
  })

  return updated
})
