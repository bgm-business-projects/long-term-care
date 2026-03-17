import { z } from 'zod/v4'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useSubscriptionServices } from '../../../utils/subscriptionServices'
import { parseBody } from '../../../shared/contracts/validation'

const PatchCodeSchema = z.object({
  disabled: z.boolean(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const { disabled } = await parseBody(event, PatchCodeSchema)
  const { adminCommand } = useSubscriptionServices()
  await adminCommand.setDisabled(id, disabled)
  return { success: true }
})
