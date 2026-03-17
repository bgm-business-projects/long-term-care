export interface ISubscriptionCacheService {
  getCachedState<T>(userId: string): Promise<T | null>
  cacheState(userId: string, state: unknown): Promise<void>
  invalidate(userId: string): Promise<void>
}
