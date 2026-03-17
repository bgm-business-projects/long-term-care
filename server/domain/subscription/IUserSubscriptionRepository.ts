import type { SubscriptionTier } from './SubscriptionTier'

export interface IUserSubscriptionRepository {
  getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier; expiresAt: Date | null }>
  updateUserTier(userId: string, tier: SubscriptionTier, expiresAt: Date | null): Promise<void>
  getLastNotifiedTier(userId: string): Promise<SubscriptionTier>
  updateLastNotifiedTier(userId: string, tier: SubscriptionTier): Promise<void>
}
