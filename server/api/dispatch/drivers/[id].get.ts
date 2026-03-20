import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getDriverById } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }

  const driver = await getDriverById(id)
  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  return driver
})
