import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const body = await readBody(event)

  if (!body.careRecipientId || !body.daysOfWeek || !body.departureTime || !body.originAddress || !body.destinationAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'careRecipientId, daysOfWeek, departureTime, originAddress, and destinationAddress are required',
    })
  }

  if (!Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'daysOfWeek must be a non-empty array' })
  }

  const { create } = useRecurringScheduleServices()

  const schedule = await create({
    careRecipientId: body.careRecipientId,
    organizationId: body.organizationId,
    daysOfWeek: body.daysOfWeek,
    departureTime: body.departureTime,
    originAddress: body.originAddress,
    originLat: body.originLat,
    originLng: body.originLng,
    destinationAddress: body.destinationAddress,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
    needsWheelchair: body.needsWheelchair,
    notes: body.notes,
    effectiveStartDate: body.effectiveStartDate,
    effectiveEndDate: body.effectiveEndDate,
    estimatedDuration: body.estimatedDuration,
  })

  setResponseStatus(event, 201)
  return schedule
})
