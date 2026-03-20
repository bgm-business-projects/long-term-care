import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { createCareRecipient } from '../../../utils/careRecipientServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const body = await readBody(event)

  if (!body.name || !body.address) {
    throw createError({ statusCode: 400, statusMessage: 'name and address are required' })
  }

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff must use their own org; admin/developer can specify
  const organizationId = userRole === 'agency_staff' ? userOrgId : body.organizationId

  const recipient = await createCareRecipient({
    organizationId,
    name: body.name,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    contactPerson: body.contactPerson,
    contactPhone: body.contactPhone,
    specialNeeds: body.specialNeeds,
    notes: body.notes,
  })

  setResponseStatus(event, 201)
  return recipient
})
