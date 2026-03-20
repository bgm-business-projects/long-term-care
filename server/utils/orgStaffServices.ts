import crypto from 'crypto'
import { useDb } from '../infrastructure/db/drizzle'
import { user, organizations } from '../infrastructure/db/schema'
import { eq, and } from 'drizzle-orm'

export async function listOrgStaff(organizationId: string) {
  const db = useDb()
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.role, 'agency_staff'), eq(user.organizationId, organizationId)))
}

export async function createOrgStaff(organizationId: string, data: { name: string; email: string }) {
  const db = useDb()

  // Verify org exists
  const orgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
  if (orgs.length === 0) throw new Error('Organization not found')

  // Check email not already taken
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, data.email))
    .limit(1)
  if (existing.length > 0) throw new Error('EMAIL_EXISTS')

  const id = crypto.randomUUID()
  await db.insert(user).values({
    id,
    name: data.name,
    email: data.email,
    emailVerified: false,
    role: 'agency_staff',
    organizationId,
    banned: false,
    subscriptionTier: 'free',
    lastNotifiedTier: 'free',
  })

  return { id, name: data.name, email: data.email, organizationId }
}

export async function removeOrgStaff(userId: string) {
  const db = useDb()
  await db
    .update(user)
    .set({ organizationId: null, role: 'user' })
    .where(and(eq(user.id, userId), eq(user.role, 'agency_staff')))
}
