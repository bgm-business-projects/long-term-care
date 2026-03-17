import { compareTiers, type SubscriptionTier } from './SubscriptionTier'

export type RedeemResult =
  | { action: 'applied'; tier: SubscriptionTier; expiresAt: Date | null }
  | { action: 'extended'; tier: SubscriptionTier; expiresAt: Date | null }
  | { action: 'already_permanent' }
  | { action: 'downgrade_confirm'; currentTier: SubscriptionTier; newTier: SubscriptionTier }

export class RedemptionRule {
  /**
   * Pure computation of redemption result — no DB side effects.
   * @param current - current subscription state
   * @param code - redemption code info
   * @param force - whether to force downgrade
   */
  static resolve(
    current: { tier: SubscriptionTier; expiresAt: Date | null },
    code: { tier: SubscriptionTier; durationDays: number | null },
    force: boolean
  ): RedeemResult {
    const cmp = compareTiers(code.tier, current.tier)
    const now = new Date()

    // Upgrade: new tier > current tier
    if (cmp > 0) {
      return {
        action: 'applied',
        tier: code.tier,
        expiresAt: code.durationDays !== null
          ? new Date(now.getTime() + code.durationDays * 86400_000)
          : null,
      }
    }

    // Same tier
    if (cmp === 0) {
      // Current is already permanent
      if (current.expiresAt === null) {
        return { action: 'already_permanent' }
      }
      // Code grants permanent
      if (code.durationDays === null) {
        return { action: 'extended', tier: code.tier, expiresAt: null }
      }
      // Code has duration — extend from max(current.expiresAt, now)
      const base = Math.max(current.expiresAt.getTime(), now.getTime())
      return {
        action: 'extended',
        tier: code.tier,
        expiresAt: new Date(base + code.durationDays * 86400_000),
      }
    }

    // Downgrade: new tier < current tier
    if (!force) {
      return { action: 'downgrade_confirm', currentTier: current.tier, newTier: code.tier }
    }
    return {
      action: 'applied',
      tier: code.tier,
      expiresAt: code.durationDays !== null
        ? new Date(now.getTime() + code.durationDays * 86400_000)
        : null,
    }
  }
}
