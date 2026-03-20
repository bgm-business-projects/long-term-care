import { requireAgencyStaff } from '../../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Schedule ID required' })
  }

  const query = getQuery(event)
  const startDate = query.startDate as string
  const endDate = query.endDate as string

  if (!startDate || !endDate) {
    throw createError({ statusCode: 400, statusMessage: 'startDate and endDate query parameters are required (YYYY-MM-DD)' })
  }

  const { expandSchedule } = useRecurringScheduleServices()

  return expandSchedule(id, startDate, endDate)
})
