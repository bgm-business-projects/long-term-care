import type { SubscriptionTier } from '../subscription/SubscriptionTier'

export interface IUserCommandRepository {
  updateRole(userId: string, role: string): Promise<void>
  updateSubscription(userId: string, tier: SubscriptionTier, expiresAt: Date | null): Promise<void>
  updateBanned(userId: string, banned: boolean): Promise<void>
  deleteUser(userId: string): Promise<void>
}
