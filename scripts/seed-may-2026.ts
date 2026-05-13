/**
 * Seed 2026-05 歷史紀錄 + 2026-05-13（今日）車隊即時動態
 *
 *  - 5/1 ~ 5/12：completed/cancelled 歷史 trips，含 trip_status_logs 模擬完整流程
 *  - 5/13（今日）：產生 assigned / in_progress 的 trips，附帶 GPS 打卡點，
 *    讓 /admin/fleet（車隊即時動態）看得到 marker
 *
 * 使用方式：npx tsx --env-file=.env scripts/seed-may-2026.ts
 *
 * ⚠ 會先刪除既有 5/1~5/31 trips
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

const DESTS = [
  { name: '台大醫院', address: '台北市中正區中山南路 7 號', lat: 25.0411, lng: 121.5165 },
  { name: '仁愛醫院', address: '台北市大安區仁愛路四段 10 號', lat: 25.0379, lng: 121.5407 },
  { name: '榮總醫院', address: '台北市北投區石牌路二段 201 號', lat: 25.1207, lng: 121.5193 },
  { name: '陽光復健中心', address: '台北市內湖區成功路四段 188 號', lat: 25.0796, lng: 121.5872 },
  { name: '亞東醫院', address: '新北市板橋區南雅南路二段 21 號', lat: 25.0084, lng: 121.4513 },
  { name: '台北馬偕', address: '台北市中山區中山北路二段 92 號', lat: 25.0578, lng: 121.5210 },
  { name: '健康檢查中心', address: '台北市信義區松仁路 56 號', lat: 25.0364, lng: 121.5661 },
]

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]! }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min: number, max: number): number { return Math.random() * (max - min) + min }
function chance(p: number): boolean { return Math.random() < p }

function dt(day: number, hour: number, minute = 0): Date {
  const mm = String(minute).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return new Date(`2026-05-${dd}T${hh}:${mm}:00+08:00`)
}

async function main() {
  console.log('🗓  Seeding 2026-05 historical + today live data...\n')

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

  // 清除 5 月 trips + carpool_groups（避免重複/孤兒）
  const mayStart = new Date('2026-05-01T00:00:00+08:00')
  const mayEnd = new Date('2026-05-31T23:59:59+08:00')
  const existing = await db.select({ id: schema.trips.id })
    .from(schema.trips)
    .where(and(gte(schema.trips.scheduledAt, mayStart), lte(schema.trips.scheduledAt, mayEnd)))
  if (existing.length > 0) {
    console.log(`🗑  刪除既有 5 月 trips: ${existing.length} 筆`)
    await db.delete(schema.trips).where(inArray(schema.trips.id, existing.map(t => t.id)))
  }
  const existingGroups = await db.select({ id: schema.carpoolGroups.id })
    .from(schema.carpoolGroups)
    .where(and(gte(schema.carpoolGroups.scheduledAt, mayStart), lte(schema.carpoolGroups.scheduledAt, mayEnd)))
  if (existingGroups.length > 0) {
    console.log(`🗑  刪除既有 5 月 carpool_groups: ${existingGroups.length} 筆`)
    await db.delete(schema.carpoolGroups).where(inArray(schema.carpoolGroups.id, existingGroups.map(g => g.id)))
  }

  let completed = 0
  let cancelled = 0
  let roundTripPairs = 0
  let carpoolBatches = 0
  let liveAssigned = 0
  let liveInProgress = 0
  let liveLogs = 0
  const driverSchedule: Record<string, Date[]> = {}

  function canAssign(driverUserId: string, scheduledAt: Date, durationMin: number): boolean {
    const slots = driverSchedule[driverUserId] || []
    const s = scheduledAt.getTime()
    const e = s + durationMin * 60_000
    for (let i = 0; i < slots.length; i += 2) {
      if (s < slots[i + 1]!.getTime() && e > slots[i]!.getTime()) return false
    }
    return true
  }
  function markBusy(driverUserId: string, scheduledAt: Date, durationMin: number) {
    const slots = driverSchedule[driverUserId] || []
    slots.push(scheduledAt, new Date(scheduledAt.getTime() + durationMin * 60_000))
    driverSchedule[driverUserId] = slots
  }

  // ── 5/1 ~ 5/12 歷史 ──
  // 工具：寫完整 status logs（completed trip）
  async function writeCompletedLogs(tripId: string, driverUserId: string, scheduledAt: Date, scheduledEndAt: Date, originLat: number, originLng: number, destLat: number, destLng: number) {
    const t0 = new Date(scheduledAt.getTime() - 10 * 60_000)
    const t1 = new Date(scheduledAt.getTime() - 2 * 60_000)
    const t2 = new Date(scheduledAt.getTime() + 1 * 60_000)
    const t3 = new Date(scheduledEndAt.getTime() + rand(-3, 5) * 60_000)
    await db.insert(schema.tripStatusLogs).values([
      { tripId, driverUserId, status: 'departed', timestamp: t0, lat: String(originLat + randFloat(-0.01, 0.01)), lng: String(originLng + randFloat(-0.01, 0.01)) },
      { tripId, driverUserId, status: 'arrived_origin', timestamp: t1, lat: String(originLat), lng: String(originLng) },
      { tripId, driverUserId, status: 'recipient_boarded', timestamp: t2, lat: String(originLat), lng: String(originLng) },
      { tripId, driverUserId, status: 'completed', timestamp: t3, lat: String(destLat), lng: String(destLng) },
    ])
  }

  for (let day = 1; day <= 12; day++) {
    const date = new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00+08:00`)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    // ── (A) 每日 1 組共乘（3 人去熱門目的地）──
    const hotDest = pick(DESTS)
    const hotHour = pick([8, 9, 10])
    const carpoolSize = rand(3, 4)
    const carpoolStartAt = dt(day, hotHour, 30)
    const carpoolDuration = rand(40, 60)
    const carpoolEndAt = new Date(carpoolStartAt.getTime() + carpoolDuration * 60_000)
    // 找一位能在此時段接的司機
    const cpEligible = drivers.filter(d => d.vehicleId && canAssign(d.userId, carpoolStartAt, carpoolDuration))
    if (cpEligible.length > 0) {
      const cpDriver = pick(cpEligible)
      markBusy(cpDriver.userId, carpoolStartAt, carpoolDuration)

      // 建立 carpool_group
      const groupId = crypto.randomUUID()
      await db.insert(schema.carpoolGroups).values({
        id: groupId,
        driverUserId: cpDriver.userId,
        vehicleId: cpDriver.vehicleId,
        destinationAddress: hotDest.address,
        destinationLat: String(hotDest.lat),
        destinationLng: String(hotDest.lng),
        scheduledAt: carpoolStartAt,
        scheduledEndAt: carpoolEndAt,
        status: 'completed',
        totalDistanceMeters: rand(8000, 22000),
        totalDurationMinutes: carpoolDuration,
      } as any)

      const pickedRecipients: typeof recipients = []
      while (pickedRecipients.length < carpoolSize && pickedRecipients.length < recipients.length) {
        const r = pick(recipients)
        if (!pickedRecipients.find(x => x.id === r.id)) pickedRecipients.push(r)
      }
      for (let i = 0; i < pickedRecipients.length; i++) {
        const recipient = pickedRecipients[i]!
        const pickupAt = new Date(carpoolStartAt.getTime() + i * rand(5, 8) * 60_000)
        const dropAt = new Date(carpoolEndAt.getTime() - (pickedRecipients.length - 1 - i) * rand(3, 6) * 60_000)
        const oLat = recipient.lat ? Number(recipient.lat) : randFloat(25.02, 25.08)
        const oLng = recipient.lng ? Number(recipient.lng) : randFloat(121.50, 121.57)
        const tripId = crypto.randomUUID()
        await db.insert(schema.trips).values({
          id: tripId,
          careRecipientId: recipient.id,
          organizationId: recipient.organizationId,
          vehicleId: cpDriver.vehicleId,
          driverUserId: cpDriver.userId,
          scheduledAt: pickupAt,
          scheduledEndAt: dropAt,
          estimatedDuration: Math.round((dropAt.getTime() - pickupAt.getTime()) / 60_000),
          originAddress: recipient.address,
          originLat: String(oLat),
          originLng: String(oLng),
          destinationAddress: hotDest.address,
          destinationLat: String(hotDest.lat),
          destinationLng: String(hotDest.lng),
          status: 'completed',
          needsWheelchair: false,
          mileageActual: String(randFloat(5, 15).toFixed(1)),
          carpoolGroupId: groupId,
          carpoolOrder: i + 1,
          carpoolPickupAt: pickupAt,
          carpoolDropoffOrder: i + 1,
          carpoolDropoffAt: dropAt,
        } as any)
        await writeCompletedLogs(tripId, cpDriver.userId, pickupAt, dropAt, oLat, oLng, hotDest.lat, hotDest.lng)
        completed++
      }
      carpoolBatches++
    }

    // ── (B) 獨立 trips（部分有來回配對）──
    const dailyCount = isWeekend ? rand(4, 6) : rand(6, 10)
    for (let i = 0; i < dailyCount; i++) {
      const recipient = pick(recipients)
      const destination = pick(DESTS)
      const hour = pick([7, 11, 13, 14, 15, 16])
      const minute = pick([0, 15, 30, 45])
      const scheduledAt = dt(day, hour, minute)
      const duration = rand(25, 75)
      const needsWheelchair = chance(0.2)

      const originLat = recipient.lat ? Number(recipient.lat) : randFloat(25.02, 25.08)
      const originLng = recipient.lng ? Number(recipient.lng) : randFloat(121.50, 121.57)

      const eligible = drivers.filter(d => {
        if (needsWheelchair && !d.isAccessible && (d.wheelchairCap ?? 0) === 0) return false
        return canAssign(d.userId, scheduledAt, duration)
      })
      if (eligible.length === 0) continue
      const driver = pick(eligible)
      markBusy(driver.userId, scheduledAt, duration)

      const isCancelled = chance(0.08)
      const status: 'completed' | 'cancelled' = isCancelled ? 'cancelled' : 'completed'
      const scheduledEndAt = new Date(scheduledAt.getTime() + duration * 60_000)
      const outboundId = crypto.randomUUID()

      // 70% 機會有回程（去程+回程都 completed，cancelled 不配回程）
      const wantRoundTrip = status === 'completed' && chance(0.7)
      let returnId: string | null = null
      let returnScheduledAt: Date | null = null
      let returnEndAt: Date | null = null
      let returnDuration = 0
      if (wantRoundTrip) {
        const waitMin = rand(60, 180)
        returnScheduledAt = new Date(scheduledEndAt.getTime() + waitMin * 60_000)
        returnDuration = rand(25, 60)
        returnEndAt = new Date(returnScheduledAt.getTime() + returnDuration * 60_000)
        // 同司機是否還可派；不行就取消回程
        if (canAssign(driver.userId, returnScheduledAt, returnDuration)) {
          returnId = crypto.randomUUID()
          markBusy(driver.userId, returnScheduledAt, returnDuration)
        }
      }

      // 去程
      await db.insert(schema.trips).values({
        id: outboundId,
        careRecipientId: recipient.id,
        organizationId: recipient.organizationId,
        vehicleId: driver.vehicleId,
        driverUserId: driver.userId,
        scheduledAt,
        scheduledEndAt,
        estimatedDuration: duration,
        originAddress: recipient.address,
        originLat: String(originLat),
        originLng: String(originLng),
        destinationAddress: destination.address,
        destinationLat: String(destination.lat),
        destinationLng: String(destination.lng),
        status,
        needsWheelchair,
        mileageActual: status === 'completed' ? String(randFloat(3, 35).toFixed(1)) : null,
        pairedTripId: returnId,
        tripDirection: returnId ? 'outbound' : null,
      } as any)
      if (status === 'completed') {
        await writeCompletedLogs(outboundId, driver.userId, scheduledAt, scheduledEndAt, originLat, originLng, destination.lat, destination.lng)
        completed++
      } else {
        cancelled++
      }

      // 回程
      if (returnId && returnScheduledAt && returnEndAt) {
        await db.insert(schema.trips).values({
          id: returnId,
          careRecipientId: recipient.id,
          organizationId: recipient.organizationId,
          vehicleId: driver.vehicleId,
          driverUserId: driver.userId,
          scheduledAt: returnScheduledAt,
          scheduledEndAt: returnEndAt,
          estimatedDuration: returnDuration,
          originAddress: destination.address,
          originLat: String(destination.lat),
          originLng: String(destination.lng),
          destinationAddress: recipient.address,
          destinationLat: String(originLat),
          destinationLng: String(originLng),
          status: 'completed',
          needsWheelchair,
          mileageActual: String(randFloat(3, 35).toFixed(1)),
          pairedTripId: outboundId,
          tripDirection: 'return',
        } as any)
        await writeCompletedLogs(returnId, driver.userId, returnScheduledAt, returnEndAt, destination.lat, destination.lng, originLat, originLng)
        completed++
        roundTripPairs++
      }
    }
  }

  // ── 5/13 今日：即時動態 ──
  console.log('\n🚗 生成 5/13 即時車隊動態...')
  // 重設今日司機行程（與歷史不衝突，因為都是新時段）
  const today = 13
  const taipeiNow = new Date()
  // 為了可預期，假設「現在時刻 = 14:30」（中午過後）
  const nowMs = dt(today, 14, 30).getTime()

  for (const driver of drivers) {
    if (!driver.vehicleId) continue

    // 每位司機今日 4 趟：1 早班完成、1 進行中（涵蓋 now）、2 待派（下午）
    type Plan = { kind: 'completed' | 'in_progress' | 'assigned'; startMs: number; endMs: number }
    const plans: Plan[] = [
      // 早班：已完成
      { kind: 'completed', startMs: dt(today, 8, rand(0, 30)).getTime(), endMs: dt(today, 9, rand(15, 45)).getTime() },
      // 進行中：跨越「現在」14:30
      { kind: 'in_progress', startMs: nowMs - rand(10, 25) * 60_000, endMs: nowMs + rand(20, 45) * 60_000 },
      // 下午：尚未派出
      { kind: 'assigned', startMs: dt(today, 16, rand(0, 30)).getTime(), endMs: dt(today, 17, rand(15, 45)).getTime() },
      { kind: 'assigned', startMs: dt(today, 18, rand(0, 30)).getTime(), endMs: dt(today, 19, rand(0, 30)).getTime() },
    ]

    for (const plan of plans) {
      const recipient = pick(recipients)
      const destination = pick(DESTS)
      const needsWheelchair = chance(0.2)
      if (needsWheelchair && !driver.isAccessible && (driver.wheelchairCap ?? 0) === 0) continue

      const originLat = recipient.lat ? Number(recipient.lat) : randFloat(25.02, 25.08)
      const originLng = recipient.lng ? Number(recipient.lng) : randFloat(121.50, 121.57)

      const scheduledAt = new Date(plan.startMs)
      const scheduledEndAt = new Date(plan.endMs)
      const duration = Math.max(15, Math.round((plan.endMs - plan.startMs) / 60_000))
      const status = plan.kind

      const tripId = crypto.randomUUID()
      await db.insert(schema.trips).values({
        id: tripId,
        careRecipientId: recipient.id,
        organizationId: recipient.organizationId,
        vehicleId: driver.vehicleId,
        driverUserId: driver.userId,
        scheduledAt,
        scheduledEndAt,
        estimatedDuration: duration,
        originAddress: recipient.address,
        originLat: String(originLat),
        originLng: String(originLng),
        destinationAddress: destination.address,
        destinationLat: String(destination.lat),
        destinationLng: String(destination.lng),
        status,
        needsWheelchair,
      } as any)

      if (status === 'in_progress') {
        // 已 departed/arrived，但還沒 completed → 在路上某個點打卡
        const t0 = new Date(scheduledAt.getTime() - 5 * 60_000)
        const t1 = new Date(scheduledAt.getTime() + 2 * 60_000)
        // 最後一筆 timestamp = nowMs，位置 = 起點 ~ 終點之間的某比例（依時間進度）
        const progress = Math.min(1, Math.max(0, (nowMs - scheduledAt.getTime()) / (scheduledEndAt.getTime() - scheduledAt.getTime())))
        const curLat = originLat + (destination.lat - originLat) * progress
        const curLng = originLng + (destination.lng - originLng) * progress
        await db.insert(schema.tripStatusLogs).values([
          { tripId, driverUserId: driver.userId, status: 'departed', timestamp: t0, lat: String(originLat + randFloat(-0.005, 0.005)), lng: String(originLng + randFloat(-0.005, 0.005)) },
          { tripId, driverUserId: driver.userId, status: 'recipient_boarded', timestamp: t1, lat: String(originLat), lng: String(originLng) },
          { tripId, driverUserId: driver.userId, status: 'recipient_boarded', timestamp: new Date(nowMs), lat: String(curLat), lng: String(curLng) },
        ])
        liveLogs += 3
        liveInProgress++
      } else if (status === 'assigned') {
        // 尚未開始 → 不打卡（地圖會顯示 0 筆或者其他司機）
        // 但為了確保 fleet positions 至少能顯示，給一筆 'departed' 在車輛 home 附近的位置（如果有 home）
        // → 不加，符合真實情境
        liveAssigned++
      } else {
        // completed 今日早班
        const t0 = new Date(scheduledAt.getTime() - 5 * 60_000)
        const t1 = new Date(scheduledAt.getTime())
        const t2 = new Date(scheduledAt.getTime() + 2 * 60_000)
        const t3 = new Date(scheduledEndAt.getTime())
        await db.insert(schema.tripStatusLogs).values([
          { tripId, driverUserId: driver.userId, status: 'departed', timestamp: t0, lat: String(originLat + randFloat(-0.005, 0.005)), lng: String(originLng + randFloat(-0.005, 0.005)) },
          { tripId, driverUserId: driver.userId, status: 'arrived_origin', timestamp: t1, lat: String(originLat), lng: String(originLng) },
          { tripId, driverUserId: driver.userId, status: 'recipient_boarded', timestamp: t2, lat: String(originLat), lng: String(originLng) },
          { tripId, driverUserId: driver.userId, status: 'completed', timestamp: t3, lat: String(destination.lat), lng: String(destination.lng) },
        ])
        liveLogs += 4
      }
    }
  }

  console.log('\n✨ 完成！')
  console.log(`  • 5/1~5/12 歷史 trips：`)
  console.log(`     - 已完成：${completed}`)
  console.log(`     - 已取消：${cancelled}`)
  console.log(`     - 共乘批次：${carpoolBatches} 組`)
  console.log(`     - 來回配對：${roundTripPairs} 組`)
  console.log(`  • 5/13 即時動態：`)
  console.log(`     - assigned：${liveAssigned}`)
  console.log(`     - in_progress：${liveInProgress}`)
  console.log(`     - status logs：${liveLogs}`)

  await client.end()
}

main().catch(err => {
  console.error(err)
  client.end()
  process.exit(1)
})
