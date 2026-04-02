import Redis from 'ioredis'

let instance: Redis | null | undefined

export function useRedis(): Redis | null {
  if (instance === undefined) {
    const config = useRuntimeConfig()
    if (!config.redisUrl) {
      console.warn('[Redis] NUXT_REDIS_URL not set, running without Redis')
      instance = null
    } else {
      instance = new Redis(config.redisUrl)
    }
  }
  return instance
}
