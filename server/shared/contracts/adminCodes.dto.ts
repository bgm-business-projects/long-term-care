import { z } from 'zod/v4'
import type { SubscriptionTier } from '~~/shared/domain/subscription'
import { SUBSCRIPTION_TIERS } from '~~/shared/domain/subscription'

// 排除 free — 兌換碼不應該降級到 free
type RedeemableTier = Exclude<SubscriptionTier, 'free'>
const REDEEMABLE_TIERS = SUBSCRIPTION_TIERS.filter((t): t is RedeemableTier => t !== 'free') as [RedeemableTier, ...RedeemableTier[]]

export const CreateCodeSchema = z.object({
  tier: z.enum(REDEEMABLE_TIERS),
  durationDays: z.number().int().positive().nullable(),
})

export const BatchCreateCodeSchema = z.object({
  tier: z.enum(REDEEMABLE_TIERS),
  durationDays: z.number().int().positive().nullable(),
  count: z.number().int().min(1).max(100),
})

export type CreateCodeDTO = z.infer<typeof CreateCodeSchema>
export type BatchCreateCodeDTO = z.infer<typeof BatchCreateCodeSchema>
