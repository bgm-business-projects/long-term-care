import { z } from 'zod/v4'
import { SUBSCRIPTION_TIERS } from '~~/shared/domain/subscription'

export const ChangeRoleSchema = z.object({
  role: z.enum(['developer', 'admin', 'user'])
})

export const ChangeSubscriptionSchema = z.object({
  tier: z.enum(SUBSCRIPTION_TIERS),
  expiresAt: z.string().nullable()
})

export const BanUserSchema = z.object({
  banned: z.boolean()
})

export type ChangeRoleDTO = z.infer<typeof ChangeRoleSchema>
export type ChangeSubscriptionDTO = z.infer<typeof ChangeSubscriptionSchema>
export type BanUserDTO = z.infer<typeof BanUserSchema>
