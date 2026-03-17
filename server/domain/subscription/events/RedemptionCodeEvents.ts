export interface RedemptionCodeDeletedEvent {
  type: 'RedemptionCodeDeleted'
  payload: { codeId: string; code: string; tier: string; deletedBy: string }
}

export type RedemptionCodeDomainEvent = RedemptionCodeDeletedEvent
