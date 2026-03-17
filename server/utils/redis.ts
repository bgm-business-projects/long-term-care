import { Redis } from '@upstash/redis'

let instance: Redis | undefined

export function useRedis(): Redis {
  if (!instance) {
    instance = Redis.fromEnv()
  }
  return instance
}
