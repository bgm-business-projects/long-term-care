import type { Redis } from '@upstash/redis'
import type { ICacheRepository } from '../../domain/cache/interfaces/ICacheRepository'

export class UpstashRedisCacheRepository implements ICacheRepository {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.redis.get<T>(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { ex: ttlSeconds })
    } catch {}
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.redis.del(...keys)
    } catch {}
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      if (members.length) {
        const [first, ...rest] = members
        await this.redis.sadd(key, first, ...rest)
      }
    } catch {}
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key)
    } catch {
      return []
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.expire(key, ttlSeconds)
    } catch {}
  }
}
