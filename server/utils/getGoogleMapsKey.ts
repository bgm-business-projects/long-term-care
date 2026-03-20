import { useDb } from '../infrastructure/db/drizzle'
import { systemSettings } from '../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

export async function getGoogleMapsKey(): Promise<string | null> {
  const db = useDb()
  const setting = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'google_maps_api_key'),
  })
  return setting?.value || null
}
