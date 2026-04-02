import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import { getRequestIP } from 'h3'
import { useRedis } from '../utils/redis'

type Limiter = RateLimiterRedis | RateLimiterMemory

let authLimiter: Limiter | undefined
let apiLimiter: Limiter | undefined

function createLimiter(keyPrefix: string, points: number, duration: number): Limiter {
  const redis = useRedis()
  if (redis) {
    return new RateLimiterRedis({ storeClient: redis, keyPrefix, points, duration })
  }
  return new RateLimiterMemory({ keyPrefix, points, duration })
}

function getAuthLimiter(): Limiter {
  if (!authLimiter) {
    authLimiter = createLimiter('rl:auth', 20, 60)
  }
  return authLimiter
}

function getApiLimiter(): Limiter {
  if (!apiLimiter) {
    apiLimiter = createLimiter('rl:api', 120, 60)
  }
  return apiLimiter
}

export default defineEventHandler(async (event) => {
  const path = event.path

  if (!path.startsWith('/api/')) return

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? '127.0.0.1'

  try {
    const isAuthRoute = path.startsWith('/api/auth/')
    const limiter = isAuthRoute ? getAuthLimiter() : getApiLimiter()
    const res = await limiter.consume(ip)

    setResponseHeaders(event, {
      'X-RateLimit-Remaining': String(res.remainingPoints),
      'X-RateLimit-Reset': String(new Date(Date.now() + res.msBeforeNext).toISOString()),
    })
  } catch (err: any) {
    if (err?.remainingPoints !== undefined) {
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
    }
    // Redis 連線失敗時 fail-open
  }
})
