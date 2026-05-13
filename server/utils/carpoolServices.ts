import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, user, driverProfiles, fleets, careRecipients, carpoolGroups } from '../infrastructure/db/schema'
import { eq, and, gte, lte, ne, isNotNull, isNull, inArray } from 'drizzle-orm'
import { useCarpoolSettings } from './carpoolSettingsServices'

interface Coord { lat: number; lng: number }

const AVG_SPEED_KMH = 30

export function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function travelMinutes(distanceMeters: number): number {
  return Math.ceil((distanceMeters / 1000) / AVG_SPEED_KMH * 60)
}

export interface CarpoolablePassenger {
  tripId: string
  careRecipientName: string | null
  originAddress: string
  originLat: number
  originLng: number
  destinationAddress: string
  destinationLat: number
  destinationLng: number
  scheduledAt: Date
  estimatedDuration: number
  needsWheelchair: boolean
}

export interface CarpoolRouteStop {
  tripId: string
  careRecipientName: string | null
  originAddress: string
  originLat: number
  originLng: number
  /** 上車順序 1, 2, 3... */
  pickupOrder: number
  /** 上車預估時刻 ISO */
  pickupAt: string
  /** 原預約時間 ISO */
  originalScheduledAt: string
  /** 多等多久（分鐘）— 負值表示比原時間早 */
  waitMinutes: number
  /** 該段車程距離（從上一站到此站） */
  segmentDistanceMeters: number
  segmentMinutes: number
}

/** 下車站（多目的地專用） */
export interface CarpoolDropoffStop {
  tripId: string
  careRecipientName: string | null
  destinationAddress: string
  destinationLat: number
  destinationLng: number
  /** 下車順序 1, 2, 3... */
  dropoffOrder: number
  /** 下車預估時刻 ISO */
  dropoffAt: string
  /** 該段車程距離（從上一站到此站） */
  segmentDistanceMeters: number
  segmentMinutes: number
}

export interface CarpoolPlan {
  passengers: CarpoolablePassenger[]
  /** 起點：司機車輛 home 或上一單終點 */
  fromAddress: string | null
  fromLat: number | null
  fromLng: number | null
  /** 排序後的上車站 */
  stops: CarpoolRouteStop[]
  /** 下車站序列（多目的地會多筆，單目的地會合併成一筆） */
  dropoffStops: CarpoolDropoffStop[]
  /** 是否多目的地 */
  multiDestination: boolean
  /** 從最後一位乘客上車後到最終目的地的距離與時間 */
  finalLegDistanceMeters: number
  finalLegMinutes: number
  /** 全程從第一段起算的總距離與時間 */
  totalDistanceMeters: number
  totalDurationMinutes: number
  /** 抵達最後一個下車點的時刻 ISO */
  arrivalAt: string
  /** 終點：單目的地 = 共同地點；多目的地 = 最後下車點 */
  destinationAddress: string
  destinationLat: number
  destinationLng: number
}

/**
 * 判斷某個 anchor trip 與 candidate trip 是否可共乘
 * - 目的地距離 < 設定門檻
 * - scheduledAt 差距 ≤ 設定窗口
 * - 輪椅需求一致
 */
function isCompatible(
  anchor: CarpoolablePassenger,
  candidate: CarpoolablePassenger,
  maxDestMeters: number,
  maxWindowMin: number,
): boolean {
  if (anchor.needsWheelchair !== candidate.needsWheelchair) return false
  const destDist = haversineMeters(
    { lat: anchor.destinationLat, lng: anchor.destinationLng },
    { lat: candidate.destinationLat, lng: candidate.destinationLng },
  )
  if (destDist > maxDestMeters) return false
  const timeDiff = Math.abs(anchor.scheduledAt.getTime() - candidate.scheduledAt.getTime()) / 60_000
  if (timeDiff > maxWindowMin) return false
  return true
}

/**
 * 從候選乘客貪婪排序：每次挑離前一站最近的下一位
 */
function greedyRoute(
  startLat: number,
  startLng: number,
  passengers: CarpoolablePassenger[],
): { ordered: CarpoolablePassenger[]; segments: { distance: number; minutes: number }[] } {
  const remaining = [...passengers]
  const ordered: CarpoolablePassenger[] = []
  const segments: { distance: number; minutes: number }[] = []
  let curLat = startLat
  let curLng = startLng
  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i]!
      const d = haversineMeters({ lat: curLat, lng: curLng }, { lat: p.originLat, lng: p.originLng })
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]!
    segments.push({ distance: bestDist, minutes: travelMinutes(bestDist) })
    ordered.push(next)
    curLat = next.originLat
    curLng = next.originLng
  }
  return { ordered, segments }
}

/**
 * 從候選 trips 找出可與 anchor 共乘的群組（含 anchor 本身）
 * 受 vehicle 座位數限制
 */
export async function findCarpoolPeers(
  anchorTripId: string,
  vehicleSeatCount: number | null,
): Promise<CarpoolablePassenger[]> {
  const db = useDb()
  const { get } = useCarpoolSettings()
  const settings = await get()

  const anchorRows = await db.select({
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
    .where(eq(trips.id, anchorTripId))
    .limit(1)

  const anchor = anchorRows[0]
  if (!anchor) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  }
  if (anchor.originLat == null || anchor.originLng == null || anchor.destinationLat == null || anchor.destinationLng == null) {
    throw createError({ statusCode: 400, statusMessage: '訂單缺少起點或終點座標' })
  }

  const anchorP: CarpoolablePassenger = {
    tripId: anchor.id,
    careRecipientName: anchor.careRecipientName,
    originAddress: anchor.originAddress,
    originLat: Number(anchor.originLat),
    originLng: Number(anchor.originLng),
    destinationAddress: anchor.destinationAddress,
    destinationLat: Number(anchor.destinationLat),
    destinationLng: Number(anchor.destinationLng),
    scheduledAt: anchor.scheduledAt,
    estimatedDuration: anchor.estimatedDuration ?? 60,
    needsWheelchair: anchor.needsWheelchair,
  }

  // 在 anchor scheduledAt 附近找未指派 trips（同日內）
  const dayStart = new Date(anchorP.scheduledAt)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(anchorP.scheduledAt)
  dayEnd.setHours(23, 59, 59, 999)

  const candidateRows = await db.select({
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
    .where(and(
      isNull(trips.driverUserId),
      isNull(trips.carpoolGroupId),
      ne(trips.id, anchorTripId),
      gte(trips.scheduledAt, dayStart),
      lte(trips.scheduledAt, dayEnd),
      ne(trips.status, 'cancelled'),
    ))

  const peers: CarpoolablePassenger[] = []
  for (const r of candidateRows) {
    if (r.originLat == null || r.originLng == null || r.destinationLat == null || r.destinationLng == null) continue
    const cand: CarpoolablePassenger = {
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
    }
    if (isCompatible(anchorP, cand, settings.maxDestinationDistanceMeters, settings.maxDepartureWindowMinutes)) {
      peers.push(cand)
    }
  }

  // 依 anchor 為基準把 anchor 也納入；按 scheduledAt 排序，再依座位數截斷
  const all = [anchorP, ...peers].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
  if (vehicleSeatCount && all.length > vehicleSeatCount) {
    return all.slice(0, vehicleSeatCount)
  }
  return all
}

/**
 * 對給定一組共乘乘客 + 司機起點，計算貪婪路線、各乘客等待、總距離時間
 */
export function buildCarpoolPlan(
  passengers: CarpoolablePassenger[],
  startLat: number,
  startLng: number,
  startAddress: string | null,
): CarpoolPlan {
  if (passengers.length === 0) {
    throw new Error('passengers empty')
  }
  const { ordered, segments } = greedyRoute(startLat, startLng, passengers)

  // 第一站上車時間 = max(駕駛到達該站時間, 原 scheduledAt)
  // 之後每站上車時間 = max(前一站上車時間 + 該段車程, 該乘客原 scheduledAt)
  const stops: CarpoolRouteStop[] = []
  // 推估司機從起點出發的時間 — 用第一位乘客的原預約時間倒推
  const firstSegmentMin = segments[0]!.minutes
  let prevTimeMs = ordered[0]!.scheduledAt.getTime() // 預設駕駛剛好抵達第一站
  // 若駕駛起點到第一位的車程已 >= 0，駕駛應在 scheduledAt - firstSegmentMin 出發
  // 此處假設駕駛照計畫出發；第一站 pickupAt = 第一位 scheduledAt
  prevTimeMs = ordered[0]!.scheduledAt.getTime()

  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i]!
    const seg = segments[i]!
    let pickupMs: number
    if (i === 0) {
      pickupMs = p.scheduledAt.getTime()
    } else {
      const arriveAtThis = prevTimeMs + seg.minutes * 60_000
      pickupMs = Math.max(arriveAtThis, p.scheduledAt.getTime())
    }
    const waitMin = Math.round((pickupMs - p.scheduledAt.getTime()) / 60_000)
    stops.push({
      tripId: p.tripId,
      careRecipientName: p.careRecipientName,
      originAddress: p.originAddress,
      originLat: p.originLat,
      originLng: p.originLng,
      pickupOrder: i + 1,
      pickupAt: new Date(pickupMs).toISOString(),
      originalScheduledAt: p.scheduledAt.toISOString(),
      waitMinutes: waitMin,
      segmentDistanceMeters: Math.round(seg.distance),
      segmentMinutes: seg.minutes,
    })
    prevTimeMs = pickupMs
  }

  // 最後一段：最後乘客上車點 → 目的地
  const last = ordered[ordered.length - 1]!
  // 用第一位乘客的目的地（其實所有人在門檻內，取群組「中心」也可）
  const destLat = passengers[0]!.destinationLat
  const destLng = passengers[0]!.destinationLng
  const destAddress = passengers[0]!.destinationAddress
  const finalDist = haversineMeters({ lat: last.originLat, lng: last.originLng }, { lat: destLat, lng: destLng })
  const finalMin = travelMinutes(finalDist)
  const arrivalAt = new Date(prevTimeMs + finalMin * 60_000).toISOString()

  const totalDist = segments.reduce((a, b) => a + b.distance, 0) + finalDist
  const totalMin = segments.reduce((a, b) => a + b.minutes, 0) + finalMin

  // 單目的地：所有人同地下車 → dropoffStops 仍照上車順序給每位一筆，方便 persist
  const dropoffStops: CarpoolDropoffStop[] = ordered.map((p, i) => ({
    tripId: p.tripId,
    careRecipientName: p.careRecipientName,
    destinationAddress: destAddress,
    destinationLat: destLat,
    destinationLng: destLng,
    dropoffOrder: i + 1,
    dropoffAt: arrivalAt,
    segmentDistanceMeters: i === 0 ? Math.round(finalDist) : 0,
    segmentMinutes: i === 0 ? finalMin : 0,
  }))

  return {
    passengers: ordered,
    fromAddress: startAddress,
    fromLat: startLat,
    fromLng: startLng,
    stops,
    dropoffStops,
    multiDestination: false,
    finalLegDistanceMeters: Math.round(finalDist),
    finalLegMinutes: finalMin,
    totalDistanceMeters: Math.round(totalDist),
    totalDurationMinutes: totalMin,
    arrivalAt,
    destinationAddress: destAddress,
    destinationLat: destLat,
    destinationLng: destLng,
  }
}

/**
 * 手動共乘：依使用者指定的上車順序 + 下車順序計算完整路線
 * - 允許多目的地（每位乘客有自己的下車點）
 * - pickupOrderIds[i] = 第 i 位上車的 tripId；dropoffOrderIds 同理
 */
export function buildManualCarpoolPlan(
  passengers: CarpoolablePassenger[],
  pickupOrderIds: string[],
  dropoffOrderIds: string[],
  startLat: number,
  startLng: number,
  startAddress: string | null,
): CarpoolPlan {
  if (passengers.length === 0) throw new Error('passengers empty')
  const byId = new Map(passengers.map(p => [p.tripId, p]))

  const pickupSeq = pickupOrderIds.map(id => {
    const p = byId.get(id)
    if (!p) throw new Error(`pickup tripId 不存在於乘客清單：${id}`)
    return p
  })
  const dropoffSeq = dropoffOrderIds.map(id => {
    const p = byId.get(id)
    if (!p) throw new Error(`dropoff tripId 不存在於乘客清單：${id}`)
    return p
  })
  if (pickupSeq.length !== passengers.length || dropoffSeq.length !== passengers.length) {
    throw new Error('pickup / dropoff 順序必須涵蓋所有乘客')
  }

  // ── 計算 pickup 段時間 ──
  const stops: CarpoolRouteStop[] = []
  let prevLat = startLat
  let prevLng = startLng
  // 第一位上車時間 = max(司機到達該站時間, 原 scheduledAt)；起點假設司機剛好抵達 ≈ 第一位 scheduledAt
  let prevTimeMs = pickupSeq[0]!.scheduledAt.getTime()
  let totalSegmentDist = 0
  let totalSegmentMin = 0

  for (let i = 0; i < pickupSeq.length; i++) {
    const p = pickupSeq[i]!
    const segDist = haversineMeters({ lat: prevLat, lng: prevLng }, { lat: p.originLat, lng: p.originLng })
    const segMin = travelMinutes(segDist)
    let pickupMs: number
    if (i === 0) {
      pickupMs = p.scheduledAt.getTime()
    } else {
      const arriveAt = prevTimeMs + segMin * 60_000
      pickupMs = Math.max(arriveAt, p.scheduledAt.getTime())
    }
    stops.push({
      tripId: p.tripId,
      careRecipientName: p.careRecipientName,
      originAddress: p.originAddress,
      originLat: p.originLat,
      originLng: p.originLng,
      pickupOrder: i + 1,
      pickupAt: new Date(pickupMs).toISOString(),
      originalScheduledAt: p.scheduledAt.toISOString(),
      waitMinutes: Math.round((pickupMs - p.scheduledAt.getTime()) / 60_000),
      segmentDistanceMeters: Math.round(segDist),
      segmentMinutes: segMin,
    })
    totalSegmentDist += segDist
    totalSegmentMin += segMin
    prevTimeMs = pickupMs
    prevLat = p.originLat
    prevLng = p.originLng
  }

  // ── 計算 dropoff 段時間 ──
  const dropoffStops: CarpoolDropoffStop[] = []
  for (let i = 0; i < dropoffSeq.length; i++) {
    const p = dropoffSeq[i]!
    const segDist = haversineMeters({ lat: prevLat, lng: prevLng }, { lat: p.destinationLat, lng: p.destinationLng })
    const segMin = travelMinutes(segDist)
    const dropMs = prevTimeMs + segMin * 60_000
    dropoffStops.push({
      tripId: p.tripId,
      careRecipientName: p.careRecipientName,
      destinationAddress: p.destinationAddress,
      destinationLat: p.destinationLat,
      destinationLng: p.destinationLng,
      dropoffOrder: i + 1,
      dropoffAt: new Date(dropMs).toISOString(),
      segmentDistanceMeters: Math.round(segDist),
      segmentMinutes: segMin,
    })
    totalSegmentDist += segDist
    totalSegmentMin += segMin
    prevTimeMs = dropMs
    prevLat = p.destinationLat
    prevLng = p.destinationLng
  }

  const lastDrop = dropoffStops[dropoffStops.length - 1]!
  const arrivalAt = lastDrop.dropoffAt
  // 多目的地檢查
  const destLats = new Set(passengers.map(p => p.destinationLat.toFixed(4) + ',' + p.destinationLng.toFixed(4)))
  const multi = destLats.size > 1

  return {
    passengers: pickupSeq,
    fromAddress: startAddress,
    fromLat: startLat,
    fromLng: startLng,
    stops,
    dropoffStops,
    multiDestination: multi,
    finalLegDistanceMeters: dropoffStops[0]?.segmentDistanceMeters ?? 0,
    finalLegMinutes: dropoffStops[0]?.segmentMinutes ?? 0,
    totalDistanceMeters: Math.round(totalSegmentDist),
    totalDurationMinutes: totalSegmentMin,
    arrivalAt,
    destinationAddress: lastDrop.destinationAddress,
    destinationLat: lastDrop.destinationLat,
    destinationLng: lastDrop.destinationLng,
  }
}

/**
 * 將共乘群寫入 DB：建立 carpool_groups + 更新每筆 trips
 */
export async function persistCarpool(
  plan: CarpoolPlan,
  driverUserId: string,
  vehicleId: string | null,
): Promise<{ carpoolGroupId: string }> {
  const db = useDb()

  const firstStopTime = new Date(plan.stops[0]!.pickupAt)
  const arrivalTime = new Date(plan.arrivalAt)

  // 多目的地時，群組顯示「多目的地」+ 最後一個地址作為座標代表
  const groupDestAddress = plan.multiDestination
    ? `多目的地（${plan.dropoffStops.length} 站）`
    : plan.destinationAddress

  const inserted = await db.insert(carpoolGroups).values({
    driverUserId,
    vehicleId,
    destinationAddress: groupDestAddress,
    destinationLat: String(plan.destinationLat),
    destinationLng: String(plan.destinationLng),
    scheduledAt: firstStopTime,
    scheduledEndAt: arrivalTime,
    totalDistanceMeters: plan.totalDistanceMeters,
    totalDurationMinutes: plan.totalDurationMinutes,
  }).returning({ id: carpoolGroups.id })

  const groupId = inserted[0]!.id

  // 以 tripId 對齊 pickup / dropoff
  const dropMap = new Map(plan.dropoffStops.map(d => [d.tripId, d]))

  for (const stop of plan.stops) {
    const drop = dropMap.get(stop.tripId)
    const tripEndAt = drop ? new Date(drop.dropoffAt) : arrivalTime
    await db.update(trips).set({
      carpoolGroupId: groupId,
      carpoolOrder: stop.pickupOrder,
      carpoolPickupAt: new Date(stop.pickupAt),
      carpoolDropoffOrder: drop?.dropoffOrder ?? null,
      carpoolDropoffAt: drop ? new Date(drop.dropoffAt) : null,
      driverUserId,
      vehicleId,
      status: 'assigned',
      // 多目的地：scheduledEndAt = 該乘客自己的下車時間；單目的地：群組抵達時間
      scheduledEndAt: tripEndAt,
    }).where(eq(trips.id, stop.tripId))
  }

  return { carpoolGroupId: groupId }
}

/**
 * 解散共乘群：清掉 trips 的 carpool 欄位、driver/vehicle 重置為 pending
 */
export async function dissolveCarpool(groupId: string): Promise<void> {
  const db = useDb()
  await db.update(trips).set({
    carpoolGroupId: null,
    carpoolOrder: null,
    carpoolPickupAt: null,
    driverUserId: null,
    vehicleId: null,
    status: 'pending',
  }).where(eq(trips.carpoolGroupId, groupId))
  await db.delete(carpoolGroups).where(eq(carpoolGroups.id, groupId))
}

/**
 * 載入某個共乘群完整資料（含 stops 排序）
 */
export async function getCarpoolDetail(groupId: string) {
  const db = useDb()
  const groupRows = await db.select().from(carpoolGroups).where(eq(carpoolGroups.id, groupId)).limit(1)
  const group = groupRows[0]
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Carpool group not found' })
  }

  const stopRows = await db.select({
    tripId: trips.id,
    careRecipientName: careRecipients.name,
    careRecipientPhone: careRecipients.contactPhone,
    originAddress: trips.originAddress,
    originLat: trips.originLat,
    originLng: trips.originLng,
    destinationAddress: trips.destinationAddress,
    destinationLat: trips.destinationLat,
    destinationLng: trips.destinationLng,
    scheduledAt: trips.scheduledAt,
    carpoolOrder: trips.carpoolOrder,
    carpoolPickupAt: trips.carpoolPickupAt,
    carpoolDropoffOrder: trips.carpoolDropoffOrder,
    carpoolDropoffAt: trips.carpoolDropoffAt,
    scheduledEndAt: trips.scheduledEndAt,
    needsWheelchair: trips.needsWheelchair,
  })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .where(eq(trips.carpoolGroupId, groupId))

  stopRows.sort((a, b) => (a.carpoolOrder ?? 0) - (b.carpoolOrder ?? 0))

  let driver: { userId: string; name: string; phone: string | null; fleetName: string | null } | null = null
  if (group.driverUserId) {
    const dRows = await db.select({
      userId: driverProfiles.userId,
      name: user.name,
      phone: driverProfiles.phone,
      fleetName: fleets.name,
    })
      .from(driverProfiles)
      .innerJoin(user, eq(driverProfiles.userId, user.id))
      .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
      .where(eq(driverProfiles.userId, group.driverUserId))
      .limit(1)
    driver = dRows[0] ?? null
  }

  let vehicle: { id: string; plate: string; vehicleType: string; homeAddress: string | null; homeLat: string | null; homeLng: string | null } | null = null
  if (group.vehicleId) {
    const vRows = await db.select({
      id: vehicles.id,
      plate: vehicles.plate,
      vehicleType: vehicles.vehicleType,
      homeAddress: vehicles.homeAddress,
      homeLat: vehicles.homeLat,
      homeLng: vehicles.homeLng,
    }).from(vehicles).where(eq(vehicles.id, group.vehicleId)).limit(1)
    vehicle = vRows[0] ?? null
  }

  return { group, stops: stopRows, driver, vehicle }
}

/**
 * 取得當日所有 carpool 群組（給 gantt 用）— 只需要 ids + scheduledAt 範圍
 */
export async function listCarpoolsForDay(date: string) {
  const db = useDb()
  const dayStart = new Date(`${date}T00:00:00+08:00`)
  const dayEnd = new Date(`${date}T23:59:59+08:00`)

  const rows = await db.select({
    id: carpoolGroups.id,
    driverUserId: carpoolGroups.driverUserId,
    destinationAddress: carpoolGroups.destinationAddress,
    scheduledAt: carpoolGroups.scheduledAt,
    scheduledEndAt: carpoolGroups.scheduledEndAt,
    status: carpoolGroups.status,
    totalDistanceMeters: carpoolGroups.totalDistanceMeters,
    totalDurationMinutes: carpoolGroups.totalDurationMinutes,
  })
    .from(carpoolGroups)
    .where(and(
      gte(carpoolGroups.scheduledAt, dayStart),
      lte(carpoolGroups.scheduledAt, dayEnd),
      ne(carpoolGroups.status, 'cancelled'),
    ))

  if (rows.length === 0) return []

  // 同時取得每群的 trips 簡訊
  const allTrips = await db.select({
    tripId: trips.id,
    carpoolGroupId: trips.carpoolGroupId,
    carpoolOrder: trips.carpoolOrder,
    carpoolPickupAt: trips.carpoolPickupAt,
    careRecipientName: careRecipients.name,
    originAddress: trips.originAddress,
    needsWheelchair: trips.needsWheelchair,
    pairedTripId: trips.pairedTripId,
    tripDirection: trips.tripDirection,
  })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .where(inArray(trips.carpoolGroupId, rows.map(r => r.id)))

  return rows
    .map(g => {
      const groupTrips = allTrips
        .filter(t => t.carpoolGroupId === g.id)
        .sort((a, b) => (a.carpoolOrder ?? 0) - (b.carpoolOrder ?? 0))
      const hasReturn = groupTrips.some(t => t.tripDirection === 'outbound' && t.pairedTripId)
      return { ...g, trips: groupTrips, hasReturn }
    })
    .filter(g => g.trips.length > 0) // 跳過孤兒群組
}
