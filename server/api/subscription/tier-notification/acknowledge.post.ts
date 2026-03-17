import { requireAuth } from '../../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { command } = useSubscriptionServices()
  return command.acknowledgeTierNotification(user.id)
})
