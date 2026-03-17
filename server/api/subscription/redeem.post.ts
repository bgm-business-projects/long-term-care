import { z } from 'zod/v4'
import { requireAuth } from '../../utils/requireAuth'
import { useSubscriptionServices } from '../../utils/subscriptionServices'
import { parseBody } from '../../shared/contracts/validation'

const RedeemSchema = z.object({
  code: z.string().min(1),
  force: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { code, force } = await parseBody(event, RedeemSchema)
  const { command } = useSubscriptionServices()
  return command.redeemCode(user.id, code, force)
})
