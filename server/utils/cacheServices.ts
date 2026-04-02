import { UpstashRedisCacheRepository } from '../infrastructure/cache/UpstashRedisCacheRepository'
import { InMemoryCacheRepository } from '../infrastructure/cache/InMemoryCacheRepository'
import { RedisSubscriptionCacheService } from '../infrastructure/cache/RedisSubscriptionCacheService'
import { SubscriptionEventBus } from '../infrastructure/subscription/SubscriptionEventBus'
import { SubscriptionCacheSubscriber } from '../application/subscription/subscribers/SubscriptionCacheSubscriber'
import type { ICacheRepository } from '../domain/cache/interfaces/ICacheRepository'
import type { ISubscriptionEventBus } from '../domain/subscription/events/ISubscriptionEventBus'

let cacheRepoInstance: ICacheRepository | undefined
let subscriptionEventBusInstance: SubscriptionEventBus | undefined

function getCacheRepo(): ICacheRepository {
  if (!cacheRepoInstance) {
    const redis = useRedis()
    cacheRepoInstance = redis
      ? new UpstashRedisCacheRepository(redis)
      : new InMemoryCacheRepository()
  }
  return cacheRepoInstance
}

export function useCacheServices() {
  const cacheRepo = getCacheRepo()
  return {
    cacheRepo,
    subCache: new RedisSubscriptionCacheService(cacheRepo),
  }
}

export function useSubscriptionEventBus(): { subscriptionEventBus: ISubscriptionEventBus } {
  if (!subscriptionEventBusInstance) {
    subscriptionEventBusInstance = new SubscriptionEventBus()

    // Register cache invalidation subscriber
    const { subCache } = useCacheServices()
    const cacheSubscriber = new SubscriptionCacheSubscriber(subCache)
    cacheSubscriber.register(subscriptionEventBusInstance)
  }
  return { subscriptionEventBus: subscriptionEventBusInstance }
}
