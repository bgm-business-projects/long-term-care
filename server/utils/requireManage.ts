import type { H3Event } from 'h3'
import { requireAuth } from './requireAuth'
import { UserPolicy } from '../domain/user/UserPolicy'

export async function requireManage(event: H3Event) {
  const session = await requireAuth(event)
  if (!UserPolicy.isAdminOrAbove((session.user as any).role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
