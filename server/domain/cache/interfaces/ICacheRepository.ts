export interface ICacheRepository {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  del(...keys: string[]): Promise<void>
  sadd(key: string, ...members: string[]): Promise<void>
  smembers(key: string): Promise<string[]>
  expire(key: string, ttlSeconds: number): Promise<void>
}
