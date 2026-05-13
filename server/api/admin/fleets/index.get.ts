import { requireAdmin } from '../../../utils/requireAdmin'
import { useFleetServices } from '../../../utils/fleetServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { listAll } = useFleetServices()
  return listAll()
})
