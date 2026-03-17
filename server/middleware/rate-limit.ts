import { Ratelimit } from '@upstash/ratelimit'
import { getRequestIP } from 'h3'

let authLimiter: Ratelimit | undefined
let apiLimiter: Ratelimit | undefined

function getAuthLimiter(): Ratelimit {
  if (!authLimiter) {
    authLimiter = new Ratelimit({
      redis: useRedis(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:auth',
    })
  }
  return authLimiter
}

function getApiLimiter(): Ratelimit {
  if (!apiLimiter) {
    apiLimiter = new Ratelimit({
      redis: useRedis(),
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rl:api',
    })
  }
  return apiLimiter
}

export default defineEventHandler(async (event) => {
  const path = event.path

  // Only rate-limit API routes
  if (!path.startsWith('/api/')) return

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? '127.0.0.1'

  try {
    const isAuthRoute = path.startsWith('/api/auth/')
    const limiter = isAuthRoute ? getAuthLimiter() : getApiLimiter()
    const identifier = `${ip}`

    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    setResponseHeaders(event, {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(reset),
    })

    if (!success) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
      })
    }
  } catch (err: any) {
    // If it's our own 429 error, re-throw
    if (err?.statusCode === 429) throw err
    // Otherwise fail-open: let the request through
  }
})
