import type { SubscriptionTier } from './SubscriptionTier'

export class SubscriptionPolicy {
  static getEffectiveTier(tier: SubscriptionTier, expiresAt: Date | null): SubscriptionTier {
    if (tier === 'free') return 'free'
    if (expiresAt === null) return tier // permanent
    if (expiresAt.getTime() > Date.now()) return tier // still valid
    return 'free' // expired
  }
}
