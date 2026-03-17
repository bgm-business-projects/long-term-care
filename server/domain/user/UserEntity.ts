import type { SubscriptionTier } from '../subscription/SubscriptionTier'

export interface UserEntity {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  subscriptionTier: SubscriptionTier
  subscriptionExpiresAt: Date | null
  banned: boolean
  convertedFromGuestAt: Date | null
  createdAt: Date
  updatedAt: Date
}
