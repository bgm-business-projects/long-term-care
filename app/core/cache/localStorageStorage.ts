import type { ICacheStorage } from './ICacheStorage'

class LocalStorageCacheStorage implements ICacheStorage {
  getItem(key: string): string | null {
    if (!import.meta.client) return null
    try { return localStorage.getItem(key) }
    catch { return null }
  }

  setItem(key: string, value: string): void {
    if (!import.meta.client) return
    try { localStorage.setItem(key, value) }
    catch { /* quota exceeded — silently ignore */ }
  }

  removeItem(key: string): void {
    if (!import.meta.client) return
    try { localStorage.removeItem(key) }
    catch {}
  }

  clearAllWithPrefix(prefix: string): void {
    if (!import.meta.client) return
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix))
      keys.forEach(k => localStorage.removeItem(k))
    } catch {}
  }
}

export const cacheStorage: ICacheStorage = new LocalStorageCacheStorage()
