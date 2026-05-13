import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useReportServices } from '../../../utils/reportServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const query = getQuery(event)
  const role = (session.user as any).role
  const sessionOrgId = (session.user as any).organizationId as string | null

  // agency_staff 強制限制自己機構
  const organizationId = role === 'agency_staff'
    ? (sessionOrgId ?? '__none__')
    : (query.organizationId as string | undefined)

  const { getRecipientReport } = useReportServices()
  return getRecipientReport({
    startDate: String(query.startDate || new Date().toISOString().split('T')[0]),
    endDate: String(query.endDate || new Date().toISOString().split('T')[0]),
    driverUserId: query.driverUserId as string | undefined,
    careRecipientId: query.careRecipientId as string | undefined,
    organizationId,
  })
})
