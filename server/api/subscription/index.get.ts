import { requireAuth } from '../../utils/requireAuth'
import { useSubscriptionServices } from '../../utils/subscriptionServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { query } = useSubscriptionServices()
  return query.getUserState(user.id)
})
