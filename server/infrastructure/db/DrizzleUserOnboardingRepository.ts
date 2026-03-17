import type { IUserOnboardingRepository } from '../../domain/onboarding/IUserOnboardingRepository'
import { useDb } from './drizzle'
import { user } from './schema'
import { eq, and, isNull } from 'drizzle-orm'

export class DrizzleUserOnboardingRepository implements IUserOnboardingRepository {
  async acceptConsent(userId: string, timestamp: Date): Promise<void> {
    const db = useDb()
    await db.update(user)
      .set({ consentAcceptedAt: timestamp })
      .where(eq(user.id, userId))
  }

  async completeOnboarding(userId: string, timestamp: Date): Promise<void> {
    const db = useDb()
    await db.update(user)
      .set({ onboardingCompletedAt: timestamp })
      .where(eq(user.id, userId))
  }

  async markConvertedFromGuest(userId: string, timestamp: Date): Promise<void> {
    const db = useDb()
    await db.update(user)
      .set({ convertedFromGuestAt: timestamp })
      .where(and(eq(user.id, userId), isNull(user.convertedFromGuestAt)))
  }
}
