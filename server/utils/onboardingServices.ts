import { DrizzleUserOnboardingRepository } from '../infrastructure/db/DrizzleUserOnboardingRepository'
import { UserOnboardingCommandService } from '../application/onboarding/UserOnboardingCommandService'

export function useOnboardingServices() {
  const repo = new DrizzleUserOnboardingRepository()
  return {
    command: new UserOnboardingCommandService(repo),
  }
}
