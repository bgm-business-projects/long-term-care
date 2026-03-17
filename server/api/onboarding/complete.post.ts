import { requireAuth } from '../../utils/requireAuth'
import { useOnboardingServices } from '../../utils/onboardingServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { command } = useOnboardingServices()
  return command.completeOnboarding(user.id)
})
