import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useServicePointServices } from '../../../utils/servicePointServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const query = getQuery(event)
  const { list } = useServicePointServices()

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  const scope = query.scope as string | undefined
  const careRecipientId = query.careRecipientId as string | undefined

  // agency_staff 的 organizationId 固定為自己的機構
  const organizationId = userRole === 'agency_staff' ? userOrgId : (query.organizationId as string | undefined)

  return list({
    search: query.search as string | undefined,
    category: query.category as 'hospital' | 'rehab' | 'other' | undefined,
    scope: scope as any,
    organizationId,
    careRecipientId,
  })
})
