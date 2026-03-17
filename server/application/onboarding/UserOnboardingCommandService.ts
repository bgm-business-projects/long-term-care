import type { IUserOnboardingRepository } from '../../domain/onboarding/IUserOnboardingRepository'
import type { CompleteOnboardingResponse } from '../../shared/contracts/onboarding.dto'

export class UserOnboardingCommandService {
  constructor(private onboardingRepo: IUserOnboardingRepository) {}

  async acceptConsent(userId: string): Promise<CompleteOnboardingResponse> {
    const now = new Date()
    await this.onboardingRepo.acceptConsent(userId, now)
    return { ok: true, completedAt: Math.floor(now.getTime() / 1000) }
  }

  async completeOnboarding(userId: string): Promise<CompleteOnboardingResponse> {
    const now = new Date()
    await this.onboardingRepo.completeOnboarding(userId, now)
    return { ok: true, completedAt: Math.floor(now.getTime() / 1000) }
  }

  async markConvertedFromGuest(userId: string): Promise<CompleteOnboardingResponse> {
    const now = new Date()
    await this.onboardingRepo.markConvertedFromGuest(userId, now)
    return { ok: true, completedAt: Math.floor(now.getTime() / 1000) }
  }
}
