import { z } from 'zod/v4'
import { eq, inArray } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { trips, vehicles, careRecipients, user, driverProfiles, fleets } from '../../../infrastructure/db/schema'
import { buildCarpoolPlan, buildManualCarpoolPlan, type CarpoolablePassenger } from '../../../utils/carpoolServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  tripIds: z.array(z.string()).min(1),
  driverUserId: z.string().min(1),
  // 手動共乘：使用者指定的上車 / 下車順序（tripId 列表）。若兩者都給，跳過自動貪婪排序
  pickupOrder: z.array(z.string()).optional(),
  dropoffOrder: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const dto = await parseBody(event, Schema)

  const db = useDb()

  // 載入該司機的車輛 + 起始地
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
    throw createError({ statusCode: 400, statusMessage: `車輛座位（${vehicle.seatCount}）不足以容納 ${dto.tripIds.length} 名乘客` })
  }
  // 沒設起始地時不報錯 — 以第一位乘客所在位置為起點

  // 載入所有 trips
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
  })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .where(inArray(trips.id, dto.tripIds))

  if (tripRows.length !== dto.tripIds.length) {
    throw createError({ statusCode: 400, statusMessage: '部分訂單不存在' })
  }

  const passengers: CarpoolablePassenger[] = []
  for (const r of tripRows) {
    if (r.originLat == null || r.originLng == null || r.destinationLat == null || r.destinationLng == null) {
      throw createError({ statusCode: 400, statusMessage: `訂單缺少座標：${r.careRecipientName || r.id}` })
    }
    passengers.push({
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
    })
  }

  // 若無 home 座標，用第一位乘客起點當作司機起點（視為「哪都可接」）
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

  // 司機資訊
  const dRows = await db.select({
    name: user.name,
    fleetName: fleets.name,
  })
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
    .where(eq(driverProfiles.userId, dto.driverUserId))
    .limit(1)

  return {
    plan,
    driver: {
      userId: dto.driverUserId,
      name: dRows[0]?.name,
      fleetName: dRows[0]?.fleetName,
      vehicleId: vehicle.id,
    },
  }
})
