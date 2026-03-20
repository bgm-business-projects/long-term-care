import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getCareRecipientById, softDeleteCareRecipient } from '../../../utils/careRecipientServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Care recipient ID required' })
  }

  const existing = await getCareRecipientById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Care recipient not found' })
  }

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff can only delete their own org's cases
  if (userRole === 'agency_staff' && existing.organizationId !== userOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await softDeleteCareRecipient(id)

  return { success: true }
})
