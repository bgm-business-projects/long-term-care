import type { SubscriptionTier } from '../domain/subscription/SubscriptionTier'

export interface SubscriptionContext {
  userId: string
  tier: SubscriptionTier
  expiresAt: Date | null
  role: string
}

export function toSubscriptionContext(user: any): SubscriptionContext {
  return {
    userId: user.id,
    tier: user.subscriptionTier ?? 'free',
    expiresAt: user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null,
    role: user.role ?? 'user',
  }
}
