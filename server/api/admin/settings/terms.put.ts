import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { systemSettings } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  content: z.string().min(1).max(20000),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const dto = await parseBody(event, Schema)
  const db = useDb()

  const existing = await db.select({ key: systemSettings.key })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'driver_terms_of_service'))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(systemSettings).values({
      key: 'driver_terms_of_service',
      value: dto.content,
      updatedBy: user.id,
    })
  } else {
    await db.update(systemSettings).set({
      value: dto.content,
      updatedBy: user.id,
    }).where(eq(systemSettings.key, 'driver_terms_of_service'))
  }

  return { ok: true }
})
