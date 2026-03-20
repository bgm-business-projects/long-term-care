import type Redis from 'ioredis'
import type { ICacheRepository } from '../../domain/cache/interfaces/ICacheRepository'

export class UpstashRedisCacheRepository implements ICacheRepository {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.redis.get(key)
      if (val === null) return null
      return JSON.parse(val) as T
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {}
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.redis.del(...keys)
    } catch {}
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      if (members.length) await this.redis.sadd(key, ...members)
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
