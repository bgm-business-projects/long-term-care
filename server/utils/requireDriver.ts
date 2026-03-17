import type { H3Event } from 'h3'
import { requireAuth } from './requireAuth'
import { UserPolicy } from '../domain/user/UserPolicy'

export async function requireDriver(event: H3Event) {
  const session = await requireAuth(event)
  const role = (session.user as any).role

  // admin and developer can also access driver endpoints (for testing)
  if (role !== 'driver' && !UserPolicy.isAdminOrAbove(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: driver role required' })
  }

  return session
}
