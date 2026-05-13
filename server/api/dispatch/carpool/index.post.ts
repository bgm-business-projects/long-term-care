import { z } from 'zod/v4'
import { eq, inArray } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips, vehicles, careRecipients } from '../../../infrastructure/db/schema'
import { buildCarpoolPlan, buildManualCarpoolPlan, persistCarpool, type CarpoolablePassenger } from '../../../utils/carpoolServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  tripIds: z.array(z.string()).min(1),
  driverUserId: z.string().min(1),
  pickupOrder: z.array(z.string()).optional(),
  dropoffOrder: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const dto = await parseBody(event, Schema)

  const db = useDb()
  const vRows = await db.select({
    id: vehicles.id,
    seatCount: vehicles.seatCount,
    homeAddress: vehicles.homeAddress,
    homeLat: vehicles.homeLat,
    homeLng: vehicles.homeLng,
  })
    .from(vehicles)
    .where(eq(vehicles.driverUserId, dto.driverUserId))
    .limit(1)
  const vehicle = vRows[0]
  if (!vehicle) {
    throw createError({ statusCode: 400, statusMessage: '司機未綁定車輛' })
  }
  if (vehicle.seatCount < dto.tripIds.length) {
    throw createError({ statusCode: 400, statusMessage: `車輛座位（${vehicle.seatCount}）不足` })
  }
  // 沒設起始地座標 → 以第一位乘客起點為司機起點

  const tripRows = await db.select({
    id: trips.id,
    careRecipientName: careRecipients.name,
    originAddress: trips.originAddress,
    originLat: trips.originLat,
    originLng: trips.originLng,
    destinationAddress: trips.destinationAddress,
    destinationLat: trips.destinationLat,
    destinationLng: trips.destinationLng,
    scheduledAt: trips.scheduledAt,
    estimatedDuration: trips.estimatedDuration,
    needsWheelchair: trips.needsWheelchair,
    driverUserId: trips.driverUserId,
    carpoolGroupId: trips.carpoolGroupId,
  })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .where(inArray(trips.id, dto.tripIds))

  if (tripRows.length !== dto.tripIds.length) {
    throw createError({ statusCode: 400, statusMessage: '部分訂單不存在' })
  }
  for (const r of tripRows) {
    if (r.carpoolGroupId) {
      throw createError({ statusCode: 409, statusMessage: `訂單已在其他共乘群：${r.careRecipientName}` })
    }
    if (r.originLat == null || r.originLng == null || r.destinationLat == null || r.destinationLng == null) {
      throw createError({ statusCode: 400, statusMessage: `訂單缺少座標：${r.careRecipientName || r.id}` })
    }
  }

  const passengers: CarpoolablePassenger[] = tripRows.map(r => ({
    tripId: r.id,
    careRecipientName: r.careRecipientName,
    originAddress: r.originAddress,
    originLat: Number(r.originLat),
    originLng: Number(r.originLng),
    destinationAddress: r.destinationAddress,
    destinationLat: Number(r.destinationLat),
    destinationLng: Number(r.destinationLng),
    scheduledAt: r.scheduledAt,
    estimatedDuration: r.estimatedDuration ?? 60,
    needsWheelchair: r.needsWheelchair,
  }))

  const hasHome = vehicle.homeLat != null && vehicle.homeLng != null
  const startLat = hasHome ? Number(vehicle.homeLat) : passengers[0]!.originLat
  const startLng = hasHome ? Number(vehicle.homeLng) : passengers[0]!.originLng
  const startAddress = hasHome ? vehicle.homeAddress : null

  const useManual = dto.pickupOrder && dto.dropoffOrder
    && dto.pickupOrder.length === passengers.length
    && dto.dropoffOrder.length === passengers.length
  const plan = useManual
    ? buildManualCarpoolPlan(passengers, dto.pickupOrder!, dto.dropoffOrder!, startLat, startLng, startAddress)
    : buildCarpoolPlan(passengers, startLat, startLng, startAddress)
  const result = await persistCarpool(plan, dto.driverUserId, vehicle.id)
  setResponseStatus(event, 201)
  return { carpoolGroupId: result.carpoolGroupId, plan }
})
