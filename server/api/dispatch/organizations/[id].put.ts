import { requireAdmin } from '../../../utils/requireAdmin'
import { useOrganizationServices } from '../../../utils/organizationServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const { update } = useOrganizationServices()
  return update(id, {
    name: body.name,
    contactPerson: body.contactPerson,
    phone: body.phone,
    address: body.address,
  })
})
