import { RateLimiterRedis } from 'rate-limiter-flexible'
import { getRequestIP } from 'h3'
import { useRedis } from '../utils/redis'

let authLimiter: RateLimiterRedis | undefined
let apiLimiter: RateLimiterRedis | undefined

function getAuthLimiter(): RateLimiterRedis {
  if (!authLimiter) {
    authLimiter = new RateLimiterRedis({
      storeClient: useRedis(),
      keyPrefix: 'rl:auth',
      points: 20,
      duration: 60,
    })
  }
  return authLimiter
}

function getApiLimiter(): RateLimiterRedis {
  if (!apiLimiter) {
    apiLimiter = new RateLimiterRedis({
      storeClient: useRedis(),
      keyPrefix: 'rl:api',
      points: 120,
      duration: 60,
    })
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
