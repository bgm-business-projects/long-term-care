import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useVehicleServices } from '../../../utils/vehicleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id') as string
  const { getById } = useVehicleServices()
  return getById(id)
})
