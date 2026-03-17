import type { IRedemptionCodeRepository } from '../../domain/subscription/IRedemptionCodeRepository'
import type { IUserSubscriptionRepository } from '../../domain/subscription/IUserSubscriptionRepository'
import type { ISubscriptionEventBus } from '../../domain/subscription/events/ISubscriptionEventBus'
import { RedemptionRule, type RedeemResult } from '../../domain/subscription/RedemptionRule'
import { SubscriptionPolicy } from '../../domain/subscription/SubscriptionPolicy'
import type { SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

export class SubscriptionCommandService {
  constructor(
    private codeRepo: IRedemptionCodeRepository,
    private userSubRepo: IUserSubscriptionRepository,
    private eventBus?: ISubscriptionEventBus
  ) {}

  async previewCode(code: string): Promise<{
    status: 'available' | 'used' | 'disabled' | 'invalid'
    tier?: SubscriptionTier
    durationDays?: number | null
  }> {
    const codeEntity = await this.codeRepo.findByCode(code)
    if (!codeEntity) return { status: 'invalid' }
    if (codeEntity.disabled) return { status: 'disabled' }
    if (codeEntity.usedById) return { status: 'used' }
    return {
      status: 'available',
      tier: codeEntity.tier as SubscriptionTier,
      durationDays: codeEntity.durationDays,
    }
  }

  async redeemCode(userId: string, code: string, force: boolean): Promise<RedeemResult> {
    // 1. Find the code
    const codeEntity = await this.codeRepo.findByCode(code)
    if (!codeEntity) {
      throw createError({ statusCode: 400, statusMessage: 'INVALID_CODE' })
    }
    if (codeEntity.disabled) {
      throw createError({ statusCode: 400, statusMessage: 'CODE_DISABLED' })
    }
    if (codeEntity.usedById) {
      throw createError({ statusCode: 400, statusMessage: 'ALREADY_USED' })
    }

    // 2. Get current subscription state
    const current = await this.userSubRepo.getUserSubscription(userId)
    const effectiveTier = SubscriptionPolicy.getEffectiveTier(current.tier, current.expiresAt)

    // 3. Pure logic resolve
    const result = RedemptionRule.resolve(
      { tier: effectiveTier, expiresAt: current.expiresAt },
      { tier: codeEntity.tier as SubscriptionTier, durationDays: codeEntity.durationDays },
      force
    )

    // 4. Apply if actionable
    if (result.action === 'applied' || result.action === 'extended') {
      await this.userSubRepo.updateUserTier(userId, result.tier, result.expiresAt)
      await this.codeRepo.markAsUsed(codeEntity.id, userId, new Date())
      // Sync lastNotifiedTier so user won't see a notification for their own action
      const newEffectiveTier = SubscriptionPolicy.getEffectiveTier(result.tier, result.expiresAt)
      await this.userSubRepo.updateLastNotifiedTier(userId, newEffectiveTier)

      this.eventBus?.emit({
        type: 'SubscriptionRedeemed',
        payload: { userId, tier: result.tier, action: result.action },
      })
    }

    return result
  }

  async acknowledgeTierNotification(userId: string): Promise<{ success: true }> {
    const sub = await this.userSubRepo.getUserSubscription(userId)
    const effectiveTier = SubscriptionPolicy.getEffectiveTier(sub.tier, sub.expiresAt)
    await this.userSubRepo.updateLastNotifiedTier(userId, effectiveTier)

    this.eventBus?.emit({
      type: 'TierNotificationAcknowledged',
      payload: { userId },
    })

    return { success: true }
  }
}
