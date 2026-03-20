import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useOrganizationServices } from '../../../utils/organizationServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id') as string
  const { getById } = useOrganizationServices()
  return getById(id)
})
