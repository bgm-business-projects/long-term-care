import { requireAdmin } from '../../../utils/requireAdmin'
import { useSubscriptionServices } from '../../../utils/subscriptionServices'
import { parseBody } from '../../../shared/contracts/validation'
import { CreateCodeSchema } from '../../../shared/contracts/adminCodes.dto'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { tier, durationDays } = await parseBody(event, CreateCodeSchema)
  const { adminCommand } = useSubscriptionServices()
  return adminCommand.createCode(tier, durationDays)
})
