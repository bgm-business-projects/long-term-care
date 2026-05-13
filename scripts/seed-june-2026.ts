/**
 * Seed 2026 年 6 月測試資料 — 涵蓋各種排班情境
 *   - 單筆訂單 / 共乘候選（同目的地+鄰近時間）
 *   - 長短距離（>10 公里 & 近距）
 *   - 輪椅 / 一般
 *   - 待派 / 已指派 / 已完成 / 已取消 / 進行中
 *   - 不同機構 + 平台直接建立（無機構）
 *   - 幾筆異常回報供 dashboard 測試
 *
 * 使用方式：npx tsx --env-file=.env scripts/seed-june-2026.ts
 *
 * ⚠ 會先刪除既有的 6/1~6/30 trips 與相關 incidents
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import * as schema from '../server/infrastructure/db/schema'

const databaseUrl = process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('NUXT_DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client, { schema })

// ── 共用目的地（用於製造共乘機會）─────────────────────────────
const DESTS = [
  { name: '台大醫院', address: '台北市中正區中山南路 7 號', lat: 25.0411, lng: 121.5165 },
  { name: '仁愛醫院', address: '台北市大安區仁愛路四段 10 號', lat: 25.0379, lng: 121.5407 },
  { name: '榮總醫院', address: '台北市北投區石牌路二段 201 號', lat: 25.1207, lng: 121.5193 },
  { name: '陽光復健中心', address: '台北市內湖區成功路四段 188 號', lat: 25.0796, lng: 121.5872 },
  { name: '亞東醫院', address: '新北市板橋區南雅南路二段 21 號', lat: 25.0084, lng: 121.4513 },
  { name: '台北馬偕', address: '台北市中山區中山北路二段 92 號', lat: 25.0578, lng: 121.5210 },
  { name: '健康檢查中心', address: '台北市信義區松仁路 56 號', lat: 25.0364, lng: 121.5661 },
]

// ── 隨機工具 ────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]! }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min: number, max: number): number { return Math.random() * (max - min) + min }
function chance(p: number): boolean { return Math.random() < p }

// 2026-06-XX 在 +08:00 時區
function dt(day: number, hour: number, minute = 0): Date {
  const mm = String(minute).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return new Date(`2026-06-${dd}T${hh}:${mm}:00+08:00`)
}

async function main() {
  console.log('🗓  Seeding 2026-06 test data...\n')

  // 0. 載入既有資料
  const recipients = await db.select().from(schema.careRecipients)
  if (recipients.length === 0) {
    console.error('❌ 尚未有照護個案，請先執行 npm run db:seed:test')
    process.exit(1)
  }
  const drivers = await db.select({
    userId: schema.driverProfiles.userId,
    name: schema.user.name,
    vehicleId: schema.vehicles.id,
    isAccessible: schema.vehicles.isAccessible,
    wheelchairCap: schema.vehicles.wheelchairCapacity,
  })
    .from(schema.driverProfiles)
    .innerJoin(schema.user, eq(schema.driverProfiles.userId, schema.user.id))
    .leftJoin(schema.vehicles, eq(schema.vehicles.driverUserId, schema.driverProfiles.userId))
    .where(and(eq(schema.driverProfiles.approvalStatus, 'approved'), eq(schema.driverProfiles.isActive, true)))

  if (drivers.length === 0) {
    console.error('❌ 尚未有可派遣司機，請先執行 npm run db:seed:test')
    process.exit(1)
  }

  console.log(`📋 ${recipients.length} 位個案、${drivers.length} 位司機`)

  // 1. 清除 6 月 trips（含相關 incidents 經 CASCADE 自動刪）
  const juneStart = new Date('2026-06-01T00:00:00+08:00')
  const juneEnd = new Date('2026-06-30T23:59:59+08:00')
  const existing = await db.select({ id: schema.trips.id })
    .from(schema.trips)
    .where(and(gte(schema.trips.scheduledAt, juneStart), lte(schema.trips.scheduledAt, juneEnd)))
  if (existing.length > 0) {
    console.log(`🗑  刪除既有 6 月 trips: ${existing.length} 筆`)
    await db.delete(schema.trips).where(inArray(schema.trips.id, existing.map(t => t.id)))
  }

  // 1.5 清除 6 月 carpool_groups（trips 刪了之後的孤兒群組）
  const existingGroups = await db.select({ id: schema.carpoolGroups.id })
    .from(schema.carpoolGroups)
    .where(and(gte(schema.carpoolGroups.scheduledAt, juneStart), lte(schema.carpoolGroups.scheduledAt, juneEnd)))
  if (existingGroups.length > 0) {
    console.log(`🗑  刪除既有 6 月 carpool_groups: ${existingGroups.length} 筆`)
    await db.delete(schema.carpoolGroups).where(inArray(schema.carpoolGroups.id, existingGroups.map(g => g.id)))
  }

  // 2. 生成 trips
  let created = 0
  let assigned = 0
  let pending = 0
  let carpoolCandidates = 0
  let roundTripPairs = 0
  const carpoolDriverSchedule: Record<string, Date[]> = {} // 司機已佔用時段

  function canAssign(driverUserId: string, scheduledAt: Date, durationMin: number): boolean {
    const slots = carpoolDriverSchedule[driverUserId] || []
    const start = scheduledAt.getTime()
    const end = start + durationMin * 60_000
    for (let i = 0; i < slots.length; i += 2) {
      const s = slots[i]!.getTime()
      const e = slots[i + 1]!.getTime()
      if (start < e && end > s) return false
    }
    return true
  }

  function markAssigned(driverUserId: string, scheduledAt: Date, durationMin: number) {
    const slots = carpoolDriverSchedule[driverUserId] || []
    slots.push(scheduledAt, new Date(scheduledAt.getTime() + durationMin * 60_000))
    carpoolDriverSchedule[driverUserId] = slots
  }

  for (let day = 1; day <= 30; day++) {
    const date = new Date(`2026-06-${String(day).padStart(2, '0')}T00:00:00+08:00`)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    // 每日 trips 數
    const dailyCount = isWeekend ? rand(3, 6) : rand(8, 14)

    // ── 共乘機會：每天挑 1-2 個熱門目的地，集中時段做出多筆同目的同時段 ──
    const hotDest = pick(DESTS)
    const hotHour = pick([8, 9, 10, 14])
    const carpoolBatch = isWeekend ? rand(2, 3) : rand(3, 5)

    for (let i = 0; i < carpoolBatch && i < recipients.length; i++) {
      const recipient = recipients[i]!
      // 同目的地 ± 一點誤差（在 500 公尺內）讓共乘演算法判定為同點
      const destLatJitter = randFloat(-0.002, 0.002)
      const destLngJitter = randFloat(-0.002, 0.002)
      // 出發時間 ± 20 分鐘窗口
      const minuteOffset = rand(-20, 20)
      const scheduledAt = dt(day, hotHour, 30 + minuteOffset)
      const duration = rand(30, 50)
      const needsWheelchair = chance(0.25)

      // 起點用 recipient 自己的地址（如無則隨機台北座標）
      const originLat = recipient.lat ? Number(recipient.lat) : randFloat(25.02, 25.08)
      const originLng = recipient.lng ? Number(recipient.lng) : randFloat(121.50, 121.57)
      const destLat = hotDest.lat + destLatJitter
      const destLng = hotDest.lng + destLngJitter

      // 共乘批次 80% 有回程
      const wantRoundTrip = chance(0.8)
      const outboundId = crypto.randomUUID()
      const returnId = wantRoundTrip ? crypto.randomUUID() : null

      await db.insert(schema.trips).values({
        id: outboundId,
        careRecipientId: recipient.id,
        organizationId: recipient.organizationId,
        scheduledAt,
        scheduledEndAt: new Date(scheduledAt.getTime() + duration * 60_000),
        estimatedDuration: duration,
        originAddress: recipient.address,
        originLat: String(originLat),
        originLng: String(originLng),
        destinationAddress: hotDest.address,
        destinationLat: String(destLat),
        destinationLng: String(destLng),
        status: 'pending',
        needsWheelchair,
        pairedTripId: returnId,
        tripDirection: wantRoundTrip ? 'outbound' : null,
      })
      created++
      pending++
      carpoolCandidates++

      if (wantRoundTrip && returnId) {
        const waitMin = rand(60, 180)
        const returnScheduledAt = new Date(scheduledAt.getTime() + (duration + waitMin) * 60_000)
        const returnDuration = rand(25, 60)
        await db.insert(schema.trips).values({
          id: returnId,
          careRecipientId: recipient.id,
          organizationId: recipient.organizationId,
          scheduledAt: returnScheduledAt,
          scheduledEndAt: new Date(returnScheduledAt.getTime() + returnDuration * 60_000),
          estimatedDuration: returnDuration,
          originAddress: hotDest.address,
          originLat: String(destLat),
          originLng: String(destLng),
          destinationAddress: recipient.address,
          destinationLat: String(originLat),
          destinationLng: String(originLng),
          status: 'pending',
          needsWheelchair,
          pairedTripId: outboundId,
          tripDirection: 'return',
        })
        created++
        pending++
        roundTripPairs++
      }
    }

    // ── 一般獨立訂單 ────────────────────────────────────────
    const remaining = dailyCount - carpoolBatch
    for (let i = 0; i < remaining; i++) {
      const recipient = pick(recipients)
      const destination = pick(DESTS)
      const hour = pick([7, 8, 9, 10, 11, 13, 14, 15, 16, 17])
      const minute = pick([0, 15, 30, 45])
      const scheduledAt = dt(day, hour, minute)
      const duration = rand(25, 90)
      const needsWheelchair = chance(0.2)

      const originLat = recipient.lat ? Number(recipient.lat) : randFloat(25.02, 25.08)
      const originLng = recipient.lng ? Number(recipient.lng) : randFloat(121.50, 121.57)

      // 30% 已指派給司機（不衝突的話）
      let driverUserId: string | null = null
      let vehicleId: string | null = null
      let status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' = 'pending'

      if (chance(0.35)) {
        const eligibleDrivers = drivers.filter(d => {
          if (needsWheelchair && !d.isAccessible && (d.wheelchairCap ?? 0) === 0) return false
          return canAssign(d.userId, scheduledAt, duration)
        })
        if (eligibleDrivers.length > 0) {
          const d = pick(eligibleDrivers)
          driverUserId = d.userId
          vehicleId = d.vehicleId
          status = 'assigned'
          markAssigned(d.userId, scheduledAt, duration)
          assigned++
        }
      }

      // 少量已取消
      if (status === 'pending' && chance(0.05)) {
        status = 'cancelled'
      } else if (status === 'pending') {
        pending++
      }

      // 80% 機會產生回程配對（cancelled 不配回程）
      const wantRoundTrip = status !== 'cancelled' && chance(0.8)
      const outboundId = crypto.randomUUID()
      const returnId = wantRoundTrip ? crypto.randomUUID() : null

      // 回程時間：去程結束 + 60~180 分鐘等待
      let returnScheduledAt: Date | null = null
      let returnDuration = 0
      let returnDriverUserId: string | null = null
      let returnVehicleId: string | null = null
      let returnStatus: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' = 'pending'

      if (wantRoundTrip && returnId) {
        const waitMin = rand(60, 180)
        returnScheduledAt = new Date(scheduledAt.getTime() + (duration + waitMin) * 60_000)
        returnDuration = rand(25, 60)

        // 若去程已指派，回程嘗試派給同司機（不衝突的話）
        if (driverUserId && canAssign(driverUserId, returnScheduledAt, returnDuration)) {
          returnDriverUserId = driverUserId
          returnVehicleId = vehicleId
          returnStatus = 'assigned'
          markAssigned(driverUserId, returnScheduledAt, returnDuration)
          assigned++
        } else {
          pending++
        }
      }

      await db.insert(schema.trips).values({
        id: outboundId,
        careRecipientId: recipient.id,
        organizationId: recipient.organizationId,
        vehicleId,
        driverUserId,
        scheduledAt,
        scheduledEndAt: new Date(scheduledAt.getTime() + duration * 60_000),
        estimatedDuration: duration,
        originAddress: recipient.address,
        originLat: String(originLat),
        originLng: String(originLng),
        destinationAddress: destination.address,
        destinationLat: String(destination.lat),
        destinationLng: String(destination.lng),
        status,
        needsWheelchair,
        pairedTripId: returnId,
        tripDirection: wantRoundTrip ? 'outbound' : null,
      })
      created++

      if (wantRoundTrip && returnId && returnScheduledAt) {
        await db.insert(schema.trips).values({
          id: returnId,
          careRecipientId: recipient.id,
          organizationId: recipient.organizationId,
          vehicleId: returnVehicleId,
          driverUserId: returnDriverUserId,
          scheduledAt: returnScheduledAt,
          scheduledEndAt: new Date(returnScheduledAt.getTime() + returnDuration * 60_000),
          estimatedDuration: returnDuration,
          // 回程：起訖對調
          originAddress: destination.address,
          originLat: String(destination.lat),
          originLng: String(destination.lng),
          destinationAddress: recipient.address,
          destinationLat: String(originLat),
          destinationLng: String(originLng),
          status: returnStatus,
          needsWheelchair,
          pairedTripId: outboundId,
          tripDirection: 'return',
        })
        created++
        roundTripPairs++
      }
    }
  }

  // 3. 加幾筆異常回報（用 6 月初已派的 trips）
  const assignedTripsIds = await db.select({ id: schema.trips.id, driverUserId: schema.trips.driverUserId })
    .from(schema.trips)
    .where(and(
      gte(schema.trips.scheduledAt, juneStart),
      lte(schema.trips.scheduledAt, dt(7, 23, 59)),
      eq(schema.trips.status, 'assigned'),
    ))
  const incidentTypes: Array<'sick' | 'missing' | 'no_show' | 'accident' | 'other'> = ['sick', 'missing', 'no_show', 'accident', 'other']
  const incidentDescriptions: Record<string, string[]> = {
    sick: ['個案臨時不適，已通知家屬', '個案高燒無法外出'],
    missing: ['抵達時個案不在家，電話無人接聽', '家屬說個案外出未歸'],
    no_show: ['依約時段個案未現身'],
    accident: ['前車追撞，輕微擦撞，已報警處理'],
    other: ['交通管制改道', '個案要求臨時改地點'],
  }
  let incidentsCreated = 0
  for (const t of assignedTripsIds.slice(0, 5)) {
    if (!t.driverUserId) continue
    const type = pick(incidentTypes)
    const desc = pick(incidentDescriptions[type] || [''])
    await db.insert(schema.tripIncidents).values({
      tripId: t.id,
      driverUserId: t.driverUserId,
      type,
      description: desc,
      reportedAt: new Date(),
      resolved: chance(0.4),
    })
    incidentsCreated++
  }

  console.log('\n✨ 完成！')
  console.log(`  • 建立 trips：${created} 筆`)
  console.log(`     - 待派：${pending}`)
  console.log(`     - 已指派：${assigned}`)
  console.log(`     - 共乘候選聚集點：${carpoolCandidates} 筆`)
  console.log(`     - 回程配對（去+回）：${roundTripPairs} 組`)
  console.log(`  • 異常回報：${incidentsCreated} 筆`)

  await client.end()
}

main().catch(err => {
  console.error(err)
  client.end()
  process.exit(1)
})
