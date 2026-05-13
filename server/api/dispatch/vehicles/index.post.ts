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

  if (!body.driverUserId) {
    throw createError({ statusCode: 400, statusMessage: 'driverUserId is required (vehicles must be bound to a driver)' })
  }

  const { create } = useVehicleServices()
  return create({
    driverUserId: body.driverUserId,
    plate: body.plate,
    vehicleType: body.vehicleType,
    seatCount: body.seatCount,
    wheelchairCapacity: body.wheelchairCapacity,
    isAccessible: body.isAccessible ?? body.hasWheelchairLift,
    isRental: body.isRental,
    notes: body.notes,
  })
})
