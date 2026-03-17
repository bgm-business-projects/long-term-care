import type { ISubscriptionEventBus } from '../../domain/subscription/events/ISubscriptionEventBus'
import type { SubscriptionDomainEvent } from '../../domain/subscription/events/SubscriptionEvents'

export class SubscriptionEventBus implements ISubscriptionEventBus {
  private handlers = new Map<string, ((event: SubscriptionDomainEvent) => void)[]>()

  emit(event: SubscriptionDomainEvent): void {
    const listeners = this.handlers.get(event.type) ?? []
    for (const handler of listeners) {
      handler(event)
    }
  }

  on(type: SubscriptionDomainEvent['type'], handler: (event: SubscriptionDomainEvent) => void): void {
    const existing = this.handlers.get(type) ?? []
    existing.push(handler)
    this.handlers.set(type, existing)
  }
}
