import type { ISubscriptionEventBus } from '../../../domain/subscription/events/ISubscriptionEventBus'
import type { ISubscriptionCacheService } from '../../../domain/cache/interfaces/ISubscriptionCacheService'

export class SubscriptionCacheSubscriber {
  constructor(
    private subCache: ISubscriptionCacheService
  ) {}

  register(eventBus: ISubscriptionEventBus): void {
    eventBus.on('SubscriptionRedeemed', (e) => {
      if (e.type === 'SubscriptionRedeemed') {
        this.subCache.invalidate(e.payload.userId)
      }
    })

    eventBus.on('AdminSubscriptionChanged', (e) => {
      if (e.type === 'AdminSubscriptionChanged') {
        this.subCache.invalidate(e.payload.userId)
      }
    })

    eventBus.on('TierNotificationAcknowledged', (e) => {
      if (e.type === 'TierNotificationAcknowledged') {
        this.subCache.invalidate(e.payload.userId)
      }
    })
  }
}
