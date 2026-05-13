import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { createTrip } from '../../../utils/tripDispatchServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { careRecipients, trips } from '../../../infrastructure/db/schema'
import { eq } from 'drizzle-orm'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const body = await readBody(event)

  if (!body.careRecipientId || !body.scheduledAt || !body.originAddress || !body.destinationAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: 'careRecipientId, scheduledAt, originAddress, and destinationAddress are required',
    })
  }

  // 攜帶輔具列表（選填）。若包含「輪椅」則同步設定 needsWheelchair=true 以與既有派車邏輯相容
  const deviceIds: string[] = Array.isArray(body.deviceIds) ? body.deviceIds : []
  const needsWheelchair = body.needsWheelchair ?? false

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

  // 來回判斷
  const roundTrip = !!body.roundTrip
  const returnScheduledAt = body.returnScheduledAt ? String(body.returnScheduledAt) : null
  if (roundTrip && !returnScheduledAt) {
    throw createError({ statusCode: 400, statusMessage: '勾選來回時必填回程出發時間' })
  }

  // 1. 建立去程
  const outbound = await createTrip({
    careRecipientId: body.careRecipientId,
    scheduledAt: body.scheduledAt,
    originAddress: body.originAddress,
    originLat: body.originLat,
    originLng: body.originLng,
    destinationAddress: body.destinationAddress,
    destinationLat: body.destinationLat,
    destinationLng: body.destinationLng,
    needsWheelchair,
    vehicleId: body.vehicleId,
    driverUserId: body.driverUserId,
    estimatedDuration: body.estimatedDuration,
    notes: body.notes,
  })

  if (outbound && deviceIds.length > 0) {
    const { setTripDevices } = useDeviceServices()
    await setTripDevices(outbound.id, deviceIds)
  }

  // 2. 若來回 → 同時建立回程，互相 link（原車去原車回）
  let returnTrip: typeof outbound = null
  if (outbound && roundTrip && returnScheduledAt) {
    returnTrip = await createTrip({
      careRecipientId: body.careRecipientId,
      scheduledAt: returnScheduledAt,
      // 回程：起點/終點互換
      originAddress: body.destinationAddress,
      originLat: body.destinationLat,
      originLng: body.destinationLng,
      destinationAddress: body.originAddress,
      destinationLat: body.originLat,
      destinationLng: body.originLng,
      needsWheelchair,
      vehicleId: body.vehicleId,
      driverUserId: body.driverUserId,
      estimatedDuration: body.returnEstimatedDuration ?? body.estimatedDuration,
      notes: body.notes ? `${body.notes}（回程）` : '回程',
    })

    if (returnTrip && deviceIds.length > 0) {
      const { setTripDevices } = useDeviceServices()
      await setTripDevices(returnTrip.id, deviceIds)
    }

    // 雙向 link 兩筆 trips
    const db = useDb()
    if (returnTrip) {
      await db.update(trips)
        .set({ pairedTripId: returnTrip.id, tripDirection: 'outbound' })
        .where(eq(trips.id, outbound.id))
      await db.update(trips)
        .set({ pairedTripId: outbound.id, tripDirection: 'return' })
        .where(eq(trips.id, returnTrip.id))
    }
  }

  setResponseStatus(event, 201)
  return { outbound, returnTrip }
})
