import { requireAdmin } from '../../../utils/requireAdmin'
import { useOrganizationServices } from '../../../utils/organizationServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)

  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const { create } = useOrganizationServices()
  return create({
    name: body.name,
    contactPerson: body.contactPerson,
    phone: body.phone,
    address: body.address,
  })
})
