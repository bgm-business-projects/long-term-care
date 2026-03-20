import { requireAdmin } from '../../../utils/requireAdmin'
import { deactivateDriver, getDriverById } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }

  const existing = await getDriverById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  await deactivateDriver(id)

  return { success: true }
})
