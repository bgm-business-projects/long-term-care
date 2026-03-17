import { z } from 'zod/v4'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useSubscriptionServices } from '../../../utils/subscriptionServices'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  z.string().uuid().parse(id)
  const { adminCommand } = useSubscriptionServices()
  await adminCommand.deleteCode(id, session.user.id)
  return { success: true }
})
