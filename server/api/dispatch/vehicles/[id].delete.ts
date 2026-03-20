import { requireAdmin } from '../../../utils/requireAdmin'
import { useVehicleServices } from '../../../utils/vehicleServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const { softDelete } = useVehicleServices()
  return softDelete(id)
})
