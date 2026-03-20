import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Schedule ID required' })
  }

  const { getById } = useRecurringScheduleServices()
  const schedule = await getById(id)

  if (!schedule) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
  }

  return schedule
})
