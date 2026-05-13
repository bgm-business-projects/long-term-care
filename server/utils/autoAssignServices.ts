import { useDb } from '../infrastructure/db/drizzle'
import { trips, vehicles, user, driverProfiles, fleets } from '../infrastructure/db/schema'
import { eq, and, gte, lte, ne, isNotNull } from 'drizzle-orm'

interface Coord { lat: number; lng: number }

const AVG_SPEED_KMH = 30 // 城市平均速度

function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function travelMinutesEstimate(distanceMeters: number): number {
  return Math.ceil((distanceMeters / 1000) / AVG_SPEED_KMH * 60)
}

function formatKm(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 公尺`
}

export interface AutoAssignSuggestion {
  driverUserId: string
  driverName: string
  fleetName: string | null
  vehiclePlate: string | null
  distanceMeters: number
  distanceText: string
  travelMinutes: number
  fromType: 'home' | 'previous_trip' | 'anywhere'
  fromAddress: string | null
  reasoning: string
  canAssign: boolean
  conflictReason?: string
}

export interface ExcludedDriver {
  driverUserId: string
  driverName: string
  reason: string
}

export function useAutoAssignServices() {
  const db = useDb()

  return {
    /**
     * 為待派訂單推薦最佳司機
     * 1. 司機未排班 → 用車輛起始地址計算距離
     * 2. 司機已排班且時間配合 → 用上一單終點計算距離
     * 3. 時間衝突 → 標記為不可指派但仍列為候補
     */
    suggestForTrip: async (tripId: string): Promise<{
      trip: { id: string; scheduledAt: Date; needsWheelchair: boolean; originAddress: string }
      suggested: AutoAssignSuggestion | null
      alternatives: AutoAssignSuggestion[]
      excluded: ExcludedDriver[]
      hasFeasible: boolean
    }> => {
      // 1. 載入目標訂單
      const tripRows = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
      const trip = tripRows[0]
      if (!trip) {
        throw createError({ statusCode: 404, statusMessage: '訂單不存在' })
      }
      if (trip.driverUserId) {
        throw createError({ statusCode: 400, statusMessage: '此訂單已指派司機' })
      }

      const tripOriginLat = trip.originLat ? Number(trip.originLat) : null
      const tripOriginLng = trip.originLng ? Number(trip.originLng) : null
      if (tripOriginLat == null || tripOriginLng == null) {
        throw createError({ statusCode: 400, statusMessage: '訂單起點未設定座標，無法自動排班' })
      }

      const tripScheduledAt = trip.scheduledAt!
      const tripScheduledEndAt = trip.scheduledEndAt
        ?? new Date(tripScheduledAt.getTime() + (trip.estimatedDuration ?? 60) * 60_000)

      // 2. 載入所有已核准司機 + 車輛 + 車行
      const driverRows = await db.select({
        userId: driverProfiles.userId,
        driverName: user.name,
        fleetName: fleets.name,
        vehicleId: vehicles.id,
        plate: vehicles.plate,
        homeAddress: vehicles.homeAddress,
        homeLat: vehicles.homeLat,
        homeLng: vehicles.homeLng,
        wheelchairCapacity: vehicles.wheelchairCapacity,
        isAccessible: vehicles.isAccessible,
      })
      .from(driverProfiles)
      .innerJoin(user, eq(driverProfiles.userId, user.id))
      .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
      .leftJoin(vehicles, eq(vehicles.driverUserId, driverProfiles.userId))
      .where(and(
        eq(driverProfiles.approvalStatus, 'approved'),
        eq(driverProfiles.isActive, true),
      ))

      // 3. 取得當天所有司機的已派訂單
      const dayStart = new Date(tripScheduledAt)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(tripScheduledAt)
      dayEnd.setHours(23, 59, 59, 999)

      const dayTrips = await db.select({
        id: trips.id,
        driverUserId: trips.driverUserId,
        scheduledAt: trips.scheduledAt,
        scheduledEndAt: trips.scheduledEndAt,
        estimatedDuration: trips.estimatedDuration,
        originAddress: trips.originAddress,
        originLat: trips.originLat,
        originLng: trips.originLng,
        destinationAddress: trips.destinationAddress,
        destinationLat: trips.destinationLat,
        destinationLng: trips.destinationLng,
      })
      .from(trips)
      .where(and(
        isNotNull(trips.driverUserId),
        gte(trips.scheduledAt, dayStart),
        lte(trips.scheduledAt, dayEnd),
        ne(trips.status, 'cancelled'),
      ))

      const tripsByDriver = new Map<string, typeof dayTrips>()
      for (const t of dayTrips) {
        if (!t.driverUserId) continue
        const list = tripsByDriver.get(t.driverUserId) ?? []
        list.push(t)
        tripsByDriver.set(t.driverUserId, list)
      }
      for (const [k, list] of tripsByDriver) {
        list.sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
        tripsByDriver.set(k, list)
      }

      // 4. 為每位司機評估
      const candidates: AutoAssignSuggestion[] = []
      const excluded: ExcludedDriver[] = []
      for (const d of driverRows) {
        if (!d.vehicleId) {
          excluded.push({ driverUserId: d.userId, driverName: d.driverName, reason: '未綁定車輛' })
          continue
        }
        // 輪椅需求過濾
        if (trip.needsWheelchair && !d.isAccessible && (d.wheelchairCapacity ?? 0) === 0) {
          excluded.push({ driverUserId: d.userId, driverName: d.driverName, reason: '個案需輪椅但車輛非無障礙車' })
          continue
        }

        const driverDayTrips = tripsByDriver.get(d.userId) ?? []
        // 找出緊接在新訂單前後的訂單
        const prev = [...driverDayTrips].reverse().find(t => t.scheduledAt! < tripScheduledAt)
        const next = driverDayTrips.find(t => t.scheduledAt! >= tripScheduledAt)

        // 時間衝突判斷
        let conflictReason: string | undefined
        if (prev && prev.scheduledEndAt && prev.scheduledEndAt > tripScheduledAt) {
          conflictReason = `與 ${prev.scheduledAt!.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 行程結束時間重疊`
        } else if (next && next.scheduledAt! < tripScheduledEndAt) {
          conflictReason = `與下一筆 ${next.scheduledAt!.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 行程衝突`
        }

        // 起點：
        //   1. 有前一單終點（含座標）→ 用前一單終點（連續排班）
        //   2. 否則用車輛起始地（home）
        //   3. 都沒有 → 視為「哪裡都可以接」，距離 0、不計車程
        let fromType: 'home' | 'previous_trip' | 'anywhere' = 'anywhere'
        let fromLat: number | null = null
        let fromLng: number | null = null
        let fromAddress: string | null = null
        if (prev && prev.destinationLat && prev.destinationLng) {
          fromType = 'previous_trip'
          fromLat = Number(prev.destinationLat)
          fromLng = Number(prev.destinationLng)
          fromAddress = prev.destinationAddress
        } else if (prev) {
          // 第二單以上但前一單沒有座標 — 視為在路上隨時可接
          fromType = 'anywhere'
        } else if (d.homeLat && d.homeLng) {
          fromType = 'home'
          fromLat = Number(d.homeLat)
          fromLng = Number(d.homeLng)
          fromAddress = d.homeAddress
        }
        // 第一單 + 無 home → fromType 仍為 'anywhere'

        const hasFromCoord = fromLat != null && fromLng != null
        const distanceMeters = hasFromCoord
          ? haversineMeters({ lat: fromLat!, lng: fromLng! }, { lat: tripOriginLat, lng: tripOriginLng })
          : 0
        const travelMinutes = hasFromCoord ? travelMinutesEstimate(distanceMeters) : 0

        // 從上一單終點移動到新訂單起點的時間是否來得及（無座標時不檢查）
        if (!conflictReason && prev && prev.scheduledEndAt && hasFromCoord && fromType === 'previous_trip') {
          const arriveTime = new Date(prev.scheduledEndAt.getTime() + travelMinutes * 60_000)
          if (arriveTime > tripScheduledAt) {
            conflictReason = `從上一單終點需 ${travelMinutes} 分鐘車程，趕不及出發時間`
          }
        }

        const reasoning = fromType === 'previous_trip'
          ? `從上一單終點「${fromAddress || '—'}」直線距離 ${formatKm(distanceMeters)}（約 ${travelMinutes} 分鐘車程）`
          : fromType === 'home'
            ? `從車輛起始地「${fromAddress || '—'}」直線距離 ${formatKm(distanceMeters)}（約 ${travelMinutes} 分鐘車程）`
            : prev
              ? '司機今日已有行程（前一單未記座標），視為可隨時接單'
              : '司機未設定起始地，視為哪都可接'

        candidates.push({
          driverUserId: d.userId,
          driverName: d.driverName,
          fleetName: d.fleetName,
          vehiclePlate: d.plate,
          distanceMeters,
          distanceText: formatKm(distanceMeters),
          travelMinutes,
          fromType,
          fromAddress,
          reasoning,
          canAssign: !conflictReason,
          conflictReason,
        })
      }

      // 5. 排序：可指派優先、距離近的優先
      candidates.sort((a, b) => {
        if (a.canAssign !== b.canAssign) return a.canAssign ? -1 : 1
        return a.distanceMeters - b.distanceMeters
      })

      const suggested = candidates[0] ?? null
      const alternatives = candidates.slice(1, 5)

      return {
        trip: {
          id: trip.id,
          scheduledAt: tripScheduledAt,
          needsWheelchair: trip.needsWheelchair,
          originAddress: trip.originAddress,
        },
        suggested,
        alternatives,
        excluded,
        hasFeasible: candidates.some(c => c.canAssign),
      }
    },
  }
}
