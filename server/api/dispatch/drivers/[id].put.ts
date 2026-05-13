import { requireAdmin } from '../../../utils/requireAdmin'
import { updateDriver } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }

  const body = await readBody(event)

  const driver = await updateDriver(id, {
    phone: body.phone,
    fleetId: body.fleetId,
    licenseExpiry: body.licenseExpiry,
    isActive: body.isActive,
    status: body.status,
    unavailableDates: body.unavailableDates,
    emergencyContact: body.emergencyContact,
    emergencyPhone: body.emergencyPhone,
  })

  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  return driver
})
