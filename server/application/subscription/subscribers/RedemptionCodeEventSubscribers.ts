import type { IRedemptionCodeEventBus } from '../../../domain/subscription/events/IRedemptionCodeEventBus'

export class RedemptionCodeEventSubscribers {
  register(eventBus: IRedemptionCodeEventBus): void {
    eventBus.on('RedemptionCodeDeleted', (_event) => {
      // Future: audit log, notification, etc.
    })
  }
}
