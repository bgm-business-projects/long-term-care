import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { listCareRecipients } from '../../../utils/careRecipientServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const query = getQuery(event)
  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff can only see their own organization's recipients
  const organizationId = (userRole === 'agency_staff')
    ? userOrgId
    : ((query.organizationId as string) || undefined)

  const filter = {
    search: (query.search as string) || undefined,
    organizationId: organizationId || undefined,
    activeOnly: query.activeOnly === 'true' ? true : undefined,
  }

  return listCareRecipients(filter)
})
