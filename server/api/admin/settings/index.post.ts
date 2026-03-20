import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { systemSettings } from '../../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readBody(event)
  const { key, value } = body

  const ALLOWED_KEYS = ['google_maps_api_key']
  if (!ALLOWED_KEYS.includes(key)) {
    throw createError({ statusCode: 400, statusMessage: '不允許的設定 key' })
  }

  const db = useDb()
  await db.insert(systemSettings)
    .values({ key, value, updatedBy: (session.user as any).id })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedBy: (session.user as any).id, updatedAt: new Date() },
    })

  return { success: true }
})
