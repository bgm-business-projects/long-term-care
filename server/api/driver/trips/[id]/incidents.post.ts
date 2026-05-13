import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireDriver } from '../../../../utils/requireDriver'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { trips, tripIncidents } from '../../../../infrastructure/db/schema'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  type: z.enum(['sick', 'missing', 'no_show', 'accident', 'other']),
  description: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const tripId = getRouterParam(event, 'id')
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'tripId required' })
  }
  const dto = await parseBody(event, Schema)

  const db = useDb()
  // 確認此趟是該司機的
  const tripRow = await db.select({ driverUserId: trips.driverUserId }).from(trips).where(eq(trips.id, tripId)).limit(1)
  if (!tripRow[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  }
  if (tripRow[0].driverUserId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Not your trip' })
  }

  const inserted = await db.insert(tripIncidents).values({
    tripId,
    driverUserId: user.id,
    type: dto.type,
    description: dto.description ?? null,
  }).returning()

  setResponseStatus(event, 201)
  return inserted[0]
})
