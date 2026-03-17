import type { RedemptionCodeDomainEvent } from './RedemptionCodeEvents'

export interface IRedemptionCodeEventBus {
  emit(event: RedemptionCodeDomainEvent): void
  on(type: RedemptionCodeDomainEvent['type'], handler: (event: RedemptionCodeDomainEvent) => void): void
}
