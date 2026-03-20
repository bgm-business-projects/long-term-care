import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Schedule ID required' })
  }

  const { getById, deactivate } = useRecurringScheduleServices()

  const existing = await getById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
  }

  await deactivate(id)

  return { success: true }
})
