import type { IRedemptionCodeEventBus } from '../../domain/subscription/events/IRedemptionCodeEventBus'
import type { RedemptionCodeDomainEvent } from '../../domain/subscription/events/RedemptionCodeEvents'

export class RedemptionCodeEventBus implements IRedemptionCodeEventBus {
  private handlers = new Map<string, ((event: RedemptionCodeDomainEvent) => void)[]>()

  emit(event: RedemptionCodeDomainEvent): void {
    const listeners = this.handlers.get(event.type) ?? []
    for (const handler of listeners) {
      handler(event)
    }
  }

  on(type: RedemptionCodeDomainEvent['type'], handler: (event: RedemptionCodeDomainEvent) => void): void {
    const existing = this.handlers.get(type) ?? []
    existing.push(handler)
    this.handlers.set(type, existing)
  }
}
