import { requireAdmin } from '../../../utils/requireAdmin'
import { useVehicleServices } from '../../../utils/vehicleServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const { update } = useVehicleServices()
  return update(id, {
    plate: body.plate,
    vehicleType: body.vehicleType,
    seatCount: body.seatCount,
    hasWheelchairLift: body.hasWheelchairLift,
    wheelchairCapacity: body.wheelchairCapacity,
    notes: body.notes,
  })
})
