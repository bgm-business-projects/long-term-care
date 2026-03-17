import type { SubscriptionDomainEvent } from './SubscriptionEvents'

export interface ISubscriptionEventBus {
  emit(event: SubscriptionDomainEvent): void
  on(type: SubscriptionDomainEvent['type'], handler: (event: SubscriptionDomainEvent) => void): void
}
