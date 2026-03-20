import { requireAdmin } from '../../../utils/requireAdmin'
import { updateTrip } from '../../../utils/tripDispatchServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Trip ID required' })
  }

  const body = await readBody(event)

  const trip = await updateTrip(id, {
    careRecipientId: body.careRecipientId,
    vehicleId: body.vehicleId,
    driverUserId: body.driverUserId,
    scheduledAt: body.scheduledAt,
    scheduledEndAt: body.scheduledEndAt,
    estimatedDuration: body.estimatedDuration,
    originAddress: body.originAddress,
    originLat: body.originLat,
    originLng: body.originLng,
    destinationAddress: body.destinationAddress,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
    status: body.status,
    mileageEstimated: body.mileageEstimated,
    mileageActual: body.mileageActual,
    needsWheelchair: body.needsWheelchair,
    notes: body.notes,
  })

  if (!trip) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  }

  return trip
})
