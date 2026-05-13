import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { getDriverById } from '../../../../utils/driverServices'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { vehicles } from '../../../../infrastructure/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }

  const driver = await getDriverById(id)
  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  const db = useDb()
  const vRows = await db.select().from(vehicles).where(eq(vehicles.driverUserId, driver.userId as string)).limit(1)

  return { driver, vehicle: vRows[0] ?? null }
})
