import { requireAdmin } from '../../../utils/requireAdmin'
import { useSubscriptionServices } from '../../../utils/subscriptionServices'
import { parseBody } from '../../../shared/contracts/validation'
import { BatchCreateCodeSchema } from '../../../shared/contracts/adminCodes.dto'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { tier, durationDays, count } = await parseBody(event, BatchCreateCodeSchema)
  const { adminCommand } = useSubscriptionServices()
  return adminCommand.createBatch(tier, durationDays, count)
})
