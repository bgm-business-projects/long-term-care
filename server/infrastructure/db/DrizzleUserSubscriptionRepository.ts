import { eq } from 'drizzle-orm'
import { useDb } from './drizzle'
import { user } from './schema'
import type { IUserSubscriptionRepository } from '../../domain/subscription/IUserSubscriptionRepository'
import { isValidTier, type SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

export class DrizzleUserSubscriptionRepository implements IUserSubscriptionRepository {
  private get db() {
    return useDb()
  }

  async getUserSubscription(userId: string): Promise<{ tier: SubscriptionTier; expiresAt: Date | null }> {
    const rows = await this.db.select({
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    }).from(user).where(eq(user.id, userId)).limit(1)

    const row = rows[0]
    if (!row) {
      return { tier: 'free', expiresAt: null }
    }

    const tier = isValidTier(row.subscriptionTier) ? row.subscriptionTier : 'free'
    return { tier, expiresAt: row.subscriptionExpiresAt }
  }

  async updateUserTier(userId: string, tier: SubscriptionTier, expiresAt: Date | null): Promise<void> {
    await this.db.update(user).set({
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
    }).where(eq(user.id, userId))
  }

  async getLastNotifiedTier(userId: string): Promise<SubscriptionTier> {
    const rows = await this.db.select({
      lastNotifiedTier: user.lastNotifiedTier,
    }).from(user).where(eq(user.id, userId)).limit(1)

    const raw = rows[0]?.lastNotifiedTier ?? 'free'
    return isValidTier(raw) ? raw : 'free'
  }

  async updateLastNotifiedTier(userId: string, tier: SubscriptionTier): Promise<void> {
    await this.db.update(user).set({
      lastNotifiedTier: tier,
    }).where(eq(user.id, userId))
  }
}
