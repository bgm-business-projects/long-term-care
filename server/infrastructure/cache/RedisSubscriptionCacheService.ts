import type { ICacheRepository } from '../../domain/cache/interfaces/ICacheRepository'
import type { ISubscriptionCacheService } from '../../domain/cache/interfaces/ISubscriptionCacheService'
import { CACHE_KEYS, CACHE_TTL } from '../../domain/cache/constants/CacheConfig'

export class RedisSubscriptionCacheService implements ISubscriptionCacheService {
  constructor(private cacheRepo: ICacheRepository) {}

  async getCachedState<T>(userId: string): Promise<T | null> {
    return this.cacheRepo.get<T>(CACHE_KEYS.subscription(userId))
  }

  async cacheState(userId: string, state: unknown): Promise<void> {
    await this.cacheRepo.set(CACHE_KEYS.subscription(userId), state, CACHE_TTL.subscription)
  }

  async invalidate(userId: string): Promise<void> {
    await this.cacheRepo.del(CACHE_KEYS.subscription(userId))
  }
}
