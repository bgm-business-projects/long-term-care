import type { IUserSubscriptionRepository } from '../../domain/subscription/IUserSubscriptionRepository'
import type { ISubscriptionCacheService } from '../../domain/cache/interfaces/ISubscriptionCacheService'
import { SubscriptionPolicy } from '../../domain/subscription/SubscriptionPolicy'
import { compareTiers } from '../../domain/subscription/SubscriptionTier'

export interface TierNotification {
  oldTier: string
  newTier: string
  direction: 'upgrade' | 'downgrade'
}

export interface SubscriptionStateDto {
  tier: string
  effectiveTier: string
  expiresAt: string | null
  usage: {}
  tierNotification?: TierNotification
}

export class SubscriptionQueryService {
  constructor(
    private userSubRepo: IUserSubscriptionRepository,
    private subCache?: ISubscriptionCacheService
  ) {}

  async getUserState(userId: string): Promise<SubscriptionStateDto> {
    // Try cache first
    if (this.subCache) {
      const cached = await this.subCache.getCachedState<SubscriptionStateDto>(userId)
      if (cached) return cached
    }

    const sub = await this.userSubRepo.getUserSubscription(userId)
    const effectiveTier = SubscriptionPolicy.getEffectiveTier(sub.tier, sub.expiresAt)

    // Check for tier change notification
    const lastNotifiedTier = await this.userSubRepo.getLastNotifiedTier(userId)
    let tierNotification: TierNotification | undefined
    if (effectiveTier !== lastNotifiedTier) {
      const cmp = compareTiers(effectiveTier, lastNotifiedTier)
      tierNotification = {
        oldTier: lastNotifiedTier,
        newTier: effectiveTier,
        direction: cmp > 0 ? 'upgrade' : 'downgrade',
      }
    }

    const result: SubscriptionStateDto = {
      tier: sub.tier,
      effectiveTier,
      expiresAt: sub.expiresAt?.toISOString() ?? null,
      usage: {},
      tierNotification,
    }

    // Write to cache
    if (this.subCache) {
      await this.subCache.cacheState(userId, result)
    }

    return result
  }
}
