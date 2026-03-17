import { UpstashRedisCacheRepository } from '../infrastructure/cache/UpstashRedisCacheRepository'
import { RedisSubscriptionCacheService } from '../infrastructure/cache/RedisSubscriptionCacheService'
import { SubscriptionEventBus } from '../infrastructure/subscription/SubscriptionEventBus'
import { SubscriptionCacheSubscriber } from '../application/subscription/subscribers/SubscriptionCacheSubscriber'
import type { ISubscriptionEventBus } from '../domain/subscription/events/ISubscriptionEventBus'

let subscriptionEventBusInstance: SubscriptionEventBus | undefined

export function useCacheServices() {
  const cacheRepo = new UpstashRedisCacheRepository(useRedis())
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
