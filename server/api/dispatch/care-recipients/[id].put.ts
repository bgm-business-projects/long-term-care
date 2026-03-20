import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getCareRecipientById, updateCareRecipient } from '../../../utils/careRecipientServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Care recipient ID required' })
  }

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff can only edit their own org's cases
  if (userRole === 'agency_staff') {
    const existing = await getCareRecipientById(id)
    if (!existing || existing.organizationId !== userOrgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const body = await readBody(event)

  const recipient = await updateCareRecipient(id, {
    organizationId: userRole === 'agency_staff' ? userOrgId : body.organizationId,
    name: body.name,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    contactPerson: body.contactPerson,
    contactPhone: body.contactPhone,
    specialNeeds: body.specialNeeds,
    notes: body.notes,
    isActive: body.isActive,
  })

  if (!recipient) {
    throw createError({ statusCode: 404, statusMessage: 'Care recipient not found' })
  }

  return recipient
})
