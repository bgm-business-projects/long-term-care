import type { ICacheEntry } from './ICache'
import { cacheStorage } from './localStorageStorage'
import { emitClientEvent } from '~/core/events/ClientEventBus'
import { CacheEvents, type SWRDataUpdatedPayload } from '~/core/events/CacheEvents'

const SWR_PREFIX = 'myapp-swr:'

export function createCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: {
    ttl: number
    initial: T
    persist?: boolean
    onBackgroundUpdate?: (newData: T) => void
  }
): ICacheEntry<T> {
  const data = ref(config.initial) as Ref<T>
  const loading = ref(false)
  const loaded = ref(false)
  const revalidating = ref(false)
  const loadedAt = ref(0)

  // Hydrate from localStorage if persist is enabled
  if (config.persist) {
    const cached = cacheStorage.getItem(SWR_PREFIX + key)
    if (cached !== null) {
      try {
        data.value = JSON.parse(cached) as T
        loaded.value = true
      } catch { /* corrupted cache — ignore */ }
    }
  }

  async function load(force = false) {
    if (!force && loaded.value && Date.now() - loadedAt.value < config.ttl) return

    // SWR path: have stale data from persist → return immediately, revalidate in background
    if (config.persist && loaded.value && !force) {
      revalidating.value = true
      fetchAndUpdate().finally(() => { revalidating.value = false })
      return
    }

    // Normal path: no stale data or force refresh
    loading.value = true
    try {
      const result = await fetcher()
      data.value = result
      loaded.value = true
      loadedAt.value = Date.now()
      if (config.persist) {
        persistData(result)
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchAndUpdate() {
    try {
      const result = await fetcher()
      const newJson = JSON.stringify(result)
      const oldJson = JSON.stringify(data.value)

      loadedAt.value = Date.now()

      if (newJson !== oldJson) {
        data.value = result
        config.onBackgroundUpdate?.(result)
        emitClientEvent<SWRDataUpdatedPayload>(CacheEvents.SWRDataUpdated, { key, timestamp: Date.now() })
      }

      persistData(result)
    } catch { /* background fetch failed — keep stale data */ }
  }

  function persistData(value: T) {
    try {
      cacheStorage.setItem(SWR_PREFIX + key, JSON.stringify(value))
    } catch { /* ignore */ }
  }

  function invalidate() {
    loadedAt.value = 0
  }

  return { data, loading, loaded, revalidating, load, invalidate }
}
