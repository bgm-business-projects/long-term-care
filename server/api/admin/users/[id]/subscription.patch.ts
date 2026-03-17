import { requireAdmin } from '../../../../utils/requireAdmin'
import { useAdminUserServices } from '../../../../utils/adminUserServices'
import { parseBody } from '../../../../shared/contracts/validation'
import { ChangeSubscriptionSchema } from '../../../../shared/contracts/adminUser.dto'
import type { SubscriptionTier } from '../../../../domain/subscription/SubscriptionTier'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' })
  }

  const { tier, expiresAt } = await parseBody(event, ChangeSubscriptionSchema)
  const { command } = useAdminUserServices()
  return command.changeSubscription(
    id,
    tier as SubscriptionTier,
    expiresAt ? new Date(expiresAt) : null
  )
})
