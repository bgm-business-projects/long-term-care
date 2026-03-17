import { DrizzleRedemptionCodeRepository } from '../infrastructure/db/DrizzleRedemptionCodeRepository'
import { DrizzleUserSubscriptionRepository } from '../infrastructure/db/DrizzleUserSubscriptionRepository'
import { RedemptionCodeEventBus } from '../infrastructure/subscription/RedemptionCodeEventBus'
import { SubscriptionCommandService } from '../application/subscription/SubscriptionCommandService'
import { SubscriptionQueryService } from '../application/subscription/SubscriptionQueryService'
import { AdminRedemptionCommandService } from '../application/subscription/AdminRedemptionCommandService'
import { AdminRedemptionQueryService } from '../application/subscription/AdminRedemptionQueryService'
import { RedemptionCodeEventSubscribers } from '../application/subscription/subscribers/RedemptionCodeEventSubscribers'

export function useSubscriptionServices() {
  const codeRepo = new DrizzleRedemptionCodeRepository()
  const userSubRepo = new DrizzleUserSubscriptionRepository()
  const redemptionEventBus = new RedemptionCodeEventBus()

  const subscribers = new RedemptionCodeEventSubscribers()
  subscribers.register(redemptionEventBus)

  // Subscription domain event bus (shared singleton for cache invalidation)
  const { subscriptionEventBus } = useSubscriptionEventBus()
  const { subCache } = useCacheServices()

  return {
    command: new SubscriptionCommandService(codeRepo, userSubRepo, subscriptionEventBus),
    query: new SubscriptionQueryService(userSubRepo, subCache),
    adminCommand: new AdminRedemptionCommandService(codeRepo, codeRepo, redemptionEventBus),
    adminQuery: new AdminRedemptionQueryService(codeRepo),
  }
}
