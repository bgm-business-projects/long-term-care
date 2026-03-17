export interface SubscriptionRedeemedEvent {
  type: 'SubscriptionRedeemed'
  payload: { userId: string; tier: string; action: string }
}

export interface AdminSubscriptionChangedEvent {
  type: 'AdminSubscriptionChanged'
  payload: { userId: string; tier: string }
}

export interface UserBannedEvent {
  type: 'UserBanned'
  payload: { userId: string; banned: boolean }
}

export interface TierNotificationAcknowledgedEvent {
  type: 'TierNotificationAcknowledged'
  payload: { userId: string }
}

export type SubscriptionDomainEvent =
  | SubscriptionRedeemedEvent
  | AdminSubscriptionChangedEvent
  | UserBannedEvent
  | TierNotificationAcknowledgedEvent
