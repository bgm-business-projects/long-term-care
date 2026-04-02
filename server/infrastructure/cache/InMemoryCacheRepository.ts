import type { ICacheRepository } from '../../domain/cache/interfaces/ICacheRepository'

export class InMemoryCacheRepository implements ICacheRepository {
  private store = new Map<string, { value: string; expiresAt: number }>()
  private sets = new Map<string, Set<string>>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return JSON.parse(entry.value) as T
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(key)
      this.sets.delete(key)
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.sets.has(key)) this.sets.set(key, new Set())
    const set = this.sets.get(key)!
    for (const m of members) set.add(m)
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])]
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000
    }
  }
}
