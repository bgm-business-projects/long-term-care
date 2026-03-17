export const SUBSCRIPTION_TIERS = ['free', 'pro', 'premium', 'partner'] as const
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number]

export const TIER_PRIORITY: Record<SubscriptionTier, number> = {
  free: 0, pro: 1, premium: 2, partner: 3
}

export const TIER_LIMITS = {
  free:    {},
  pro:     {},
  premium: {},
  partner: {},
} as const

export type TierLimits = typeof TIER_LIMITS[SubscriptionTier]

export function compareTiers(a: SubscriptionTier, b: SubscriptionTier): number {
  return TIER_PRIORITY[a] - TIER_PRIORITY[b]
}

export function isValidTier(value: string): value is SubscriptionTier {
  return value in TIER_PRIORITY
}
