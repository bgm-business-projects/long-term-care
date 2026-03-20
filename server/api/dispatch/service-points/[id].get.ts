import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useServicePointServices } from '../../../utils/servicePointServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id') as string
  const { getById } = useServicePointServices()
  return getById(id)
})
