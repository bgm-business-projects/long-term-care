import { requireAdmin } from '../../../utils/requireAdmin'
import { useVehicleServices } from '../../../utils/vehicleServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)

  if (!body.plate) {
    throw createError({ statusCode: 400, statusMessage: 'plate is required' })
  }
  if (!body.vehicleType) {
    throw createError({ statusCode: 400, statusMessage: 'vehicleType is required' })
  }

  const { create } = useVehicleServices()
  return create({
    plate: body.plate,
    vehicleType: body.vehicleType,
    seatCount: body.seatCount,
    hasWheelchairLift: body.hasWheelchairLift,
    wheelchairCapacity: body.wheelchairCapacity,
    notes: body.notes,
  })
})
