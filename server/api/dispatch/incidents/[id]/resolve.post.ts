import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { tripIncidents } from '../../../../infrastructure/db/schema'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  resolutionNote: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const dto = await parseBody(event, Schema)
  const db = useDb()
  const updated = await db.update(tripIncidents).set({
    resolved: true,
    resolvedAt: new Date(),
    resolvedById: user.id,
    resolutionNote: dto.resolutionNote ?? null,
  }).where(eq(tripIncidents.id, id)).returning()
  if (updated.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Incident not found' })
  }
  return updated[0]
})
