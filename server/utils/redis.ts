import Redis from 'ioredis'

let instance: Redis | undefined

export function useRedis(): Redis {
  if (!instance) {
    const config = useRuntimeConfig()
    instance = new Redis(config.redisUrl)
  }
  return instance
}
