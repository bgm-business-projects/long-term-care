import { requireAgencyStaff } from '../../utils/requireAgencyStaff'
import { useDashboardServices } from '../../utils/dashboardServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const query = getQuery(event)
  const today = new Date().toISOString().split('T')[0]!
  // 兼容舊 ?date=；優先用 dateFrom/dateTo
  const dateFrom = (query.dateFrom as string) || (query.date as string) || today
  const dateTo = (query.dateTo as string) || (query.date as string) || today

  const role = (session.user as any).role as string
  const sessionOrgId = (session.user as any).organizationId as string | null
  const scope = (query.scope as string) || ''

  // 機構過濾：
  //  - scope=agency：強制用登入者的 organizationId（即使是 admin 也只看自己機構；無 orgId 則無資料）
  //  - 否則：agency_staff 自動限自己機構，admin/developer 看全部
  let orgFilter: string | null
  if (scope === 'agency') {
    orgFilter = sessionOrgId ?? '__no_org__'
  } else {
    orgFilter = role === 'agency_staff' ? sessionOrgId : null
  }

  const { getSummary } = useDashboardServices()
  return getSummary(dateFrom, dateTo, orgFilter)
})
