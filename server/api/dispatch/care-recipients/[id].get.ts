import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getCareRecipientById } from '../../../utils/careRecipientServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Care recipient ID required' })
  }

  const recipient = await getCareRecipientById(id)
  if (!recipient) {
    throw createError({ statusCode: 404, statusMessage: 'Care recipient not found' })
  }

  // agency_staff can only access their own organization's recipients
  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  if (userRole === 'agency_staff' && recipient.organizationId !== userOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return recipient
})
