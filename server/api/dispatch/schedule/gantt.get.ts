import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useGanttServices } from '../../../utils/ganttServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const { date } = getQuery(event)
  if (!date || typeof date !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'date 參數必填，格式 YYYY-MM-DD' })
  }
  const { getGanttData } = useGanttServices()
  return getGanttData(date)
})
