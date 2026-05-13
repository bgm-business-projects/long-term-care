import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDb } from '../../../infrastructure/db/drizzle'
import { tripIncidents, trips, careRecipients, user, organizations } from '../../../infrastructure/db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const role = (session.user as any).role
  const sessionOrgId = (session.user as any).organizationId
  const query = getQuery(event)
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const conditions = []
  if (dateFrom) {
    conditions.push(gte(tripIncidents.reportedAt, new Date(`${dateFrom}T00:00:00+08:00`)))
  }
  if (dateTo) {
    conditions.push(lte(tripIncidents.reportedAt, new Date(`${dateTo}T23:59:59+08:00`)))
  }
  if (role === 'agency_staff' && sessionOrgId) {
    conditions.push(eq(trips.organizationId, sessionOrgId))
  }

  const db = useDb()
  const rows = await db.select({
    id: tripIncidents.id,
    tripId: tripIncidents.tripId,
    type: tripIncidents.type,
    description: tripIncidents.description,
    reportedAt: tripIncidents.reportedAt,
    resolved: tripIncidents.resolved,
    resolvedAt: tripIncidents.resolvedAt,
    driverName: user.name,
    careRecipientName: careRecipients.name,
    organizationName: organizations.name,
    tripScheduledAt: trips.scheduledAt,
    tripStatus: trips.status,
  })
  .from(tripIncidents)
  .leftJoin(trips, eq(tripIncidents.tripId, trips.id))
  .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
  .leftJoin(user, eq(tripIncidents.driverUserId, user.id))
  .leftJoin(organizations, eq(trips.organizationId, organizations.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(tripIncidents.reportedAt))

  return rows
})
