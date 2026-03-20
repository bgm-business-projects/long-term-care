import { requireAdmin } from '../../../utils/requireAdmin'
import { createDriver } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)

  if (!body.name || !body.email || !body.phone) {
    throw createError({ statusCode: 400, statusMessage: 'name, email, and phone are required' })
  }

  const driver = await createDriver({
    name: body.name,
    email: body.email,
    phone: body.phone,
    licenseExpiry: body.licenseExpiry,
    emergencyContact: body.emergencyContact,
    emergencyPhone: body.emergencyPhone,
    canDriveWheelchairVan: body.canDriveWheelchairVan,
  })

  setResponseStatus(event, 201)
  return driver
})
