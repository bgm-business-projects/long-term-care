import { requireAgencyStaff } from '../../utils/requireAgencyStaff'
import { useDashboardServices } from '../../utils/dashboardServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const { date } = getQuery(event)
  const targetDate = (date as string) || new Date().toISOString().split('T')[0]
  const { getSummary } = useDashboardServices()
  return getSummary(targetDate)
})
