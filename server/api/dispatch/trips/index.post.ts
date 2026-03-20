import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { createTrip } from '../../../utils/tripDispatchServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { careRecipients } from '../../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const body = await readBody(event)

  if (!body.careRecipientId || !body.scheduledAt || !body.originAddress || !body.destinationAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'careRecipientId, scheduledAt, originAddress, and destinationAddress are required',
    })
  }

  if (body.needsWheelchair === undefined || body.needsWheelchair === null) {
    throw createError({ statusCode: 400, statusMessage: 'needsWheelchair is required' })
  }

  // agency_staff 只能為自己機構的個案建立訂單
  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId as string | null
  if (userRole === 'agency_staff' && userOrgId) {
    const db = useDb()
    const [recipient] = await db.select({ organizationId: careRecipients.organizationId })
      .from(careRecipients).where(eq(careRecipients.id, body.careRecipientId)).limit(1)
    if (!recipient || recipient.organizationId !== userOrgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const trip = await createTrip({
    careRecipientId: body.careRecipientId,
    scheduledAt: body.scheduledAt,
    originAddress: body.originAddress,
    originLat: body.originLat,
    originLng: body.originLng,
    destinationAddress: body.destinationAddress,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
    needsWheelchair: body.needsWheelchair,
    vehicleId: body.vehicleId,
    driverUserId: body.driverUserId,
    estimatedDuration: body.estimatedDuration,
    notes: body.notes,
  })

  setResponseStatus(event, 201)
  return trip
})
