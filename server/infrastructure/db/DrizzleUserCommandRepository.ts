import { eq } from 'drizzle-orm'
import { useDb } from './drizzle'
import { user } from './schema'
import type { IUserCommandRepository } from '../../domain/user/IUserCommandRepository'
import type { SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

export class DrizzleUserCommandRepository implements IUserCommandRepository {
  private get db() {
    return useDb()
  }

  async updateRole(userId: string, role: string): Promise<void> {
    await this.db.update(user).set({ role }).where(eq(user.id, userId))
  }

  async updateSubscription(userId: string, tier: SubscriptionTier, expiresAt: Date | null): Promise<void> {
    await this.db.update(user).set({
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
    }).where(eq(user.id, userId))
  }

  async updateBanned(userId: string, banned: boolean): Promise<void> {
    await this.db.update(user).set({ banned }).where(eq(user.id, userId))
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(user).where(eq(user.id, userId))
  }
}
