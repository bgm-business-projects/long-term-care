import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useRecurringScheduleServices } from '../../../utils/recurringScheduleServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const query = getQuery(event)
  const { list } = useRecurringScheduleServices()

  return list({
    careRecipientId: query.careRecipientId as string | undefined,
    organizationId: query.organizationId as string | undefined,
    activeOnly: query.activeOnly === 'true' || query.activeOnly === '1',
  })
})
