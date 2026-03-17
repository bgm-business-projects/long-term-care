import type { H3Event } from 'h3'
import { useAuth } from '../infrastructure/auth/better-auth'

export async function requireAuth(event: H3Event) {
  const auth = useAuth()
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if ((session.user as any).banned) {
    throw createError({ statusCode: 403, statusMessage: 'ACCOUNT_BANNED' })
  }

  return session
}
