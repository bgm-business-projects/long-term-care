import { requireAdmin } from '../../../utils/requireAdmin'
import { useOrganizationServices } from '../../../utils/organizationServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const { delete: deleteOrg } = useOrganizationServices()
  return deleteOrg(id)
})
