/** 各領域的快取失效事件類型 */
export const CacheEvents = {
  SubscriptionChanged: 'cache:subscription-changed',
  SWRDataUpdated: 'cache:swr-data-updated',
} as const

export interface SWRDataUpdatedPayload {
  key: string
  timestamp: number
}
