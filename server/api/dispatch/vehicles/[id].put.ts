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
    wheelchairCapacity: body.wheelchairCapacity,
    isAccessible: body.isAccessible ?? body.hasWheelchairLift,
    isRental: body.isRental,
    homeAddress: body.homeAddress,
    homeLat: body.homeLat,
    homeLng: body.homeLng,
    vehiclePhotoKey: body.vehiclePhotoKey,
    vehicleRegistrationKey: body.vehicleRegistrationKey,
    compulsoryInsurer: body.compulsoryInsurer,
    insuranceExpiry: body.insuranceExpiry,
    hasThirdPartyLiability: body.hasThirdPartyLiability,
    hasPassengerLiability: body.hasPassengerLiability,
    hasDriverInjury: body.hasDriverInjury,
    hasExcessLiability: body.hasExcessLiability,
    notes: body.notes,
    isActive: body.isActive,
  })
})
