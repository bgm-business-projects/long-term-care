/**
 * Seed 測試資料（含完整業務情境）
 * 使用方式：npm run db:seed:test
 *
 * 前置需求：先執行 npm run db:seed 建立 admin 帳號
 *
 * 測試情境：
 *   - 2 間機構（陽光長照中心、仁愛護理之家）
 *   - 5 台車輛（含輪椅車）
 *   - 4 位司機
 *   - 8 位照護個案（含輪椅、臥床需求）
 *   - 4 個服務據點（醫院、復健中心）
 *   - 週期性排程 + 臨時訂單
 *   - 公告
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { scryptAsync } from '@noble/hashes/scrypt.js'
import { hex } from '@better-auth/utils/hex'
import * as schema from '../server/infrastructure/db/schema'

const databaseUrl = process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('❌ NUXT_DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client, { schema })

async function hashPassword(password: string): Promise<string> {
  const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)))
  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${hex.encode(key)}`
}

// ── Helper：建立使用者 + credential account ──────────────────
async function ensureUser(data: {
  email: string
  name: string
  password: string
  role: string
  organizationId?: string
}) {
  const existing = await db.select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, data.email))
    .limit(1)

  if (existing.length > 0) {
    // Update organizationId if provided (e.g. re-seeding agency_staff)
    if (data.organizationId) {
      await db.update(schema.user)
        .set({ organizationId: data.organizationId })
        .where(eq(schema.user.id, existing[0].id))
      console.log(`  🔄 ${data.email} updated organizationId`)
    } else {
      console.log(`  ⏭  ${data.email} already exists`)
    }
    return existing[0].id
  }

  const userId = crypto.randomUUID()
  const hashedPassword = await hashPassword(data.password)
  const now = new Date()

  await db.insert(schema.user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: true,
    role: data.role,
    organizationId: data.organizationId ?? null,
    banned: false,
    subscriptionTier: 'free',
    lastNotifiedTier: 'free',
    consentAcceptedAt: now,
    onboardingCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  })

  console.log(`  ✅ Created user: ${data.email} (${data.role})`)
  return userId
}

// ══════════════════════════════════════════════════════════════
// 測試資料定義
// ══════════════════════════════════════════════════════════════

async function seedTestData() {
  console.log('🌱 開始建立測試資料...\n')

  // ── 1. 機構 ─────────────────────────────────────────────
  console.log('📋 建立機構...')
  const orgs = [
    {
      name: '陽光長照中心',
      contactPerson: '王主任',
      phone: '02-2345-6789',
      address: '台北市中正區忠孝東路一段100號',
    },
    {
      name: '仁愛護理之家',
      contactPerson: '李組長',
      phone: '02-8765-4321',
      address: '台北市大安區仁愛路三段50號',
    },
  ]

  const orgIds: string[] = []
  for (const org of orgs) {
    const existing = await db.select({ id: schema.organizations.id })
      .from(schema.organizations).where(eq(schema.organizations.name, org.name)).limit(1)
    if (existing.length > 0) {
      orgIds.push(existing[0].id)
      console.log(`  ⏭  ${org.name} already exists`)
      continue
    }
    const [row] = await db.insert(schema.organizations).values({
      id: crypto.randomUUID(),
      ...org,
    }).returning({ id: schema.organizations.id })
    orgIds.push(row.id)
    console.log(`  ✅ ${org.name}`)
  }

  // ── 2. 機構人員（agency_staff） ─────────────────────────
  console.log('\n👤 建立機構人員...')
  await ensureUser({
    email: 'staff-sunlight@test.com',
    name: '王小明',
    password: 'Test1234',
    role: 'agency_staff',
    organizationId: orgIds[0], // 陽光長照中心
  })
  await ensureUser({
    email: 'staff-renai@test.com',
    name: '李小華',
    password: 'Test1234',
    role: 'agency_staff',
    organizationId: orgIds[1], // 仁愛護理之家
  })

  // ── 3. 車輛 ─────────────────────────────────────────────
  console.log('\n🚗 建立車輛...')
  const vehicles = [
    { plate: 'ABC-1234', vehicleType: '廂型車', seatCount: 7, hasWheelchairLift: false, wheelchairCapacity: 0, notes: '主力接送車' },
    { plate: 'DEF-5678', vehicleType: '輪椅車', seatCount: 4, hasWheelchairLift: true, wheelchairCapacity: 2, notes: '具備輪椅升降設備' },
    { plate: 'GHI-9012', vehicleType: '轎車', seatCount: 4, hasWheelchairLift: false, wheelchairCapacity: 0, notes: '小型接送' },
    { plate: 'JKL-3456', vehicleType: '輪椅車', seatCount: 4, hasWheelchairLift: true, wheelchairCapacity: 1, notes: '備用輪椅車' },
    { plate: 'MNO-7890', vehicleType: '廂型車', seatCount: 9, hasWheelchairLift: false, wheelchairCapacity: 0, notes: '大型廂型車' },
  ]

  const vehicleIds: string[] = []
  for (const v of vehicles) {
    const existing = await db.select({ id: schema.vehicles.id })
      .from(schema.vehicles).where(eq(schema.vehicles.plate, v.plate)).limit(1)
    if (existing.length > 0) {
      vehicleIds.push(existing[0].id)
      console.log(`  ⏭  ${v.plate} already exists`)
      continue
    }
    const [row] = await db.insert(schema.vehicles).values({ id: crypto.randomUUID(), ...v })
      .returning({ id: schema.vehicles.id })
    vehicleIds.push(row.id)
    console.log(`  ✅ ${v.plate} (${v.vehicleType})`)
  }

  // ── 4. 司機 ─────────────────────────────────────────────
  console.log('\n🧑‍✈️ 建立司機...')
  const drivers = [
    { email: 'driver-chen@test.com', name: '陳大偉', phone: '0912-345-678', licenseExpiry: '2027-06-30', canDriveWheelchairVan: true, emergencyContact: '陳太太', emergencyPhone: '0922-111-222' },
    { email: 'driver-lin@test.com', name: '林志明', phone: '0923-456-789', licenseExpiry: '2026-12-31', canDriveWheelchairVan: true, emergencyContact: '林太太', emergencyPhone: '0933-222-333' },
    { email: 'driver-wu@test.com', name: '吳建國', phone: '0934-567-890', licenseExpiry: '2027-03-15', canDriveWheelchairVan: false, emergencyContact: '吳太太', emergencyPhone: '0944-333-444' },
    { email: 'driver-zhang@test.com', name: '張正義', phone: '0945-678-901', licenseExpiry: '2026-09-30', canDriveWheelchairVan: false, emergencyContact: '張太太', emergencyPhone: '0955-444-555' },
  ]

  const driverUserIds: string[] = []
  for (const d of drivers) {
    const userId = await ensureUser({
      email: d.email,
      name: d.name,
      password: 'Driver123',
      role: 'driver',
    })
    driverUserIds.push(userId)

    // 建立 driverProfile
    const existingProfile = await db.select({ id: schema.driverProfiles.id })
      .from(schema.driverProfiles)
      .where(eq(schema.driverProfiles.userId, userId))
      .limit(1)

    if (existingProfile.length === 0) {
      await db.insert(schema.driverProfiles).values({
        id: crypto.randomUUID(),
        userId,
        phone: d.phone,
        licenseExpiry: d.licenseExpiry,
        status: 'active',
        canDriveWheelchairVan: d.canDriveWheelchairVan,
        emergencyContact: d.emergencyContact,
        emergencyPhone: d.emergencyPhone,
      })
      console.log(`  ✅ 司機 ${d.name} + profile`)
    }
  }

  // ── 5. 照護個案 ─────────────────────────────────────────
  console.log('\n🏥 建立照護個案...')
  const careRecipients = [
    // 陽光長照中心的個案
    { organizationId: orgIds[0], name: '陳爺爺', address: '台北市中正區重慶南路一段10號', lat: 25.0425, lng: 121.5135, contactPerson: '陳小姐', contactPhone: '0911-111-111', specialNeeds: 'general' as const, notes: '行動緩慢，需攙扶上下車' },
    { organizationId: orgIds[0], name: '林奶奶', address: '台北市中正區南昌路二段5號', lat: 25.0305, lng: 121.5145, contactPerson: '林先生', contactPhone: '0911-222-222', specialNeeds: 'wheelchair' as const, notes: '需輪椅接送，固定洗腎' },
    { organizationId: orgIds[0], name: '黃伯伯', address: '台北市萬華區西園路二段30號', lat: 25.0285, lng: 121.4975, contactPerson: '黃太太', contactPhone: '0911-333-333', specialNeeds: 'general' as const, notes: '聽力不佳，請大聲說話' },
    { organizationId: orgIds[0], name: '張阿嬤', address: '台北市大同區延平北路三段20號', lat: 25.0625, lng: 121.5105, contactPerson: '張先生', contactPhone: '0911-444-444', specialNeeds: 'bedridden' as const, notes: '臥床個案，需擔架接送' },
    // 仁愛護理之家的個案
    { organizationId: orgIds[1], name: '劉爺爺', address: '台北市大安區信義路四段15號', lat: 25.0335, lng: 121.5485, contactPerson: '劉太太', contactPhone: '0911-555-555', specialNeeds: 'wheelchair' as const, notes: '電動輪椅，較重' },
    { organizationId: orgIds[1], name: '王奶奶', address: '台北市信義區松仁路50號', lat: 25.0355, lng: 121.5675, contactPerson: '王小姐', contactPhone: '0911-666-666', specialNeeds: 'general' as const, notes: '需提前10分鐘到達' },
    { organizationId: orgIds[1], name: '趙伯伯', address: '台北市松山區民生東路五段10號', lat: 25.0585, lng: 121.5605, contactPerson: '趙先生', contactPhone: '0911-777-777', specialNeeds: 'general' as const, notes: '有輕微失智，請耐心等候' },
    { organizationId: orgIds[1], name: '周阿嬤', address: '台北市內湖區成功路四段25號', lat: 25.0795, lng: 121.5875, contactPerson: '周先生', contactPhone: '0911-888-888', specialNeeds: 'wheelchair' as const, notes: '手動輪椅' },
  ]

  const careRecipientIds: string[] = []
  for (const cr of careRecipients) {
    const existing = await db.select({ id: schema.careRecipients.id })
      .from(schema.careRecipients).where(eq(schema.careRecipients.name, cr.name)).limit(1)
    if (existing.length > 0) {
      careRecipientIds.push(existing[0].id)
      console.log(`  ⏭  ${cr.name} already exists`)
      continue
    }
    const [row] = await db.insert(schema.careRecipients).values({
      id: crypto.randomUUID(), ...cr,
      lat: cr.lat != null ? String(cr.lat) : null,
      lng: cr.lng != null ? String(cr.lng) : null,
    }).returning({ id: schema.careRecipients.id })
    careRecipientIds.push(row.id)
    console.log(`  ✅ ${cr.name} (${cr.specialNeeds}) - ${cr.organizationId === orgIds[0] ? '陽光' : '仁愛'}`)
  }

  // ── 6. 服務據點 ─────────────────────────────────────────
  console.log('\n📍 建立服務據點...')

  type SPScope = { organizationId?: string | null; careRecipientId?: string | null }
  async function ensureServicePoint(sp: { name: string; address: string; lat: number; lng: number; category: 'hospital' | 'rehab' | 'other' } & SPScope) {
    const existing = await db.select({ id: schema.servicePoints.id })
      .from(schema.servicePoints).where(eq(schema.servicePoints.name, sp.name)).limit(1)
    if (existing.length > 0) {
      console.log(`  ⏭  ${sp.name} already exists`)
      return existing[0].id
    }
    const [row] = await db.insert(schema.servicePoints).values({
      id: crypto.randomUUID(),
      name: sp.name, address: sp.address, category: sp.category,
      lat: String(sp.lat), lng: String(sp.lng),
      organizationId: sp.organizationId ?? null,
      careRecipientId: sp.careRecipientId ?? null,
    }).returning({ id: schema.servicePoints.id })
    console.log(`  ✅ ${sp.name} (${sp.category})`)
    return row.id
  }

  // 全域據點（admin 管理，所有機構建單時可選）
  console.log('  [全域]')
  const spNtu = await ensureServicePoint({ name: '台大醫院', address: '台北市中正區常德街1號', lat: 25.0405, lng: 121.5185, category: 'hospital' })
  const spVgh = await ensureServicePoint({ name: '台北榮民總醫院', address: '台北市北投區石牌路二段201號', lat: 25.1215, lng: 121.5165, category: 'hospital' })

  // 機構專屬據點
  console.log('  [陽光長照中心]')
  const spSunRehab = await ensureServicePoint({ name: '陽光復健中心', address: '台北市中山區南京東路二段50號', lat: 25.0525, lng: 121.5315, category: 'rehab', organizationId: orgIds[0] })
  await ensureServicePoint({ name: '陽光聯合診所', address: '台北市中正區重慶南路二段15號', lat: 25.0395, lng: 121.5115, category: 'other', organizationId: orgIds[0] })
  await ensureServicePoint({ name: '馬偕紀念醫院', address: '台北市中山區中山北路二段92號', lat: 25.0605, lng: 121.5225, category: 'hospital', organizationId: orgIds[0] })
  await ensureServicePoint({ name: '中正健康服務中心', address: '台北市中正區汀州路一段36號', lat: 25.0165, lng: 121.5095, category: 'other', organizationId: orgIds[0] })

  console.log('  [仁愛護理之家]')
  const spRenaiDay = await ensureServicePoint({ name: '仁愛日間照護中心', address: '台北市大安區仁愛路四段10號', lat: 25.0375, lng: 121.5505, category: 'other', organizationId: orgIds[1] })
  await ensureServicePoint({ name: '大安復健診所', address: '台北市大安區敦化南路一段30號', lat: 25.0415, lng: 121.5525, category: 'rehab', organizationId: orgIds[1] })
  await ensureServicePoint({ name: '國泰綜合醫院', address: '台北市大安區仁愛路四段280號', lat: 25.0335, lng: 121.5515, category: 'hospital', organizationId: orgIds[1] })
  await ensureServicePoint({ name: '松山健康服務中心', address: '台北市松山區八德路四段692號', lat: 25.0505, lng: 121.5775, category: 'other', organizationId: orgIds[1] })

  // 個案專屬據點
  console.log('  [個案專屬]')
  // 陳爺爺（general，陽光）
  await ensureServicePoint({ name: '陳爺爺復健室', address: '台大醫院復健部 2F', lat: 25.0405, lng: 121.5185, category: 'rehab', careRecipientId: careRecipientIds[0] })
  await ensureServicePoint({ name: '陳爺爺家庭醫師診所', address: '台北市中正區羅斯福路一段12號', lat: 25.0275, lng: 121.5145, category: 'other', careRecipientId: careRecipientIds[0] })
  // 林奶奶（wheelchair，陽光）
  await ensureServicePoint({ name: '林奶奶洗腎室', address: '台大醫院血液透析中心 B1', lat: 25.0405, lng: 121.5185, category: 'hospital', careRecipientId: careRecipientIds[1] })
  await ensureServicePoint({ name: '林奶奶眼科', address: '台北市中正區忠孝西路一段36號 8F', lat: 25.0455, lng: 121.5175, category: 'hospital', careRecipientId: careRecipientIds[1] })
  await ensureServicePoint({ name: '林奶奶藥局', address: '台北市中正區南昌路一段50號', lat: 25.0295, lng: 121.5175, category: 'other', careRecipientId: careRecipientIds[1] })
  // 黃伯伯（general，陽光）
  await ensureServicePoint({ name: '黃伯伯門診室', address: '台北榮民總醫院門診部', lat: 25.1215, lng: 121.5165, category: 'hospital', careRecipientId: careRecipientIds[2] })
  await ensureServicePoint({ name: '黃伯伯物理治療', address: '台北市萬華區西園路二段33號', lat: 25.0285, lng: 121.4985, category: 'rehab', careRecipientId: careRecipientIds[2] })
  // 張阿嬤（bedridden，陽光）
  await ensureServicePoint({ name: '張阿嬤專科門診', address: '台大醫院急診暨創傷部 1F', lat: 25.0405, lng: 121.5185, category: 'hospital', careRecipientId: careRecipientIds[3] })
  await ensureServicePoint({ name: '張阿嬤復健', address: '台北市大同區延平北路四段1號', lat: 25.0665, lng: 121.5115, category: 'rehab', careRecipientId: careRecipientIds[3] })
  // 劉爺爺（wheelchair，仁愛）
  await ensureServicePoint({ name: '劉爺爺固定復健', address: '台北市大安區敦化南路一段30號 3F', lat: 25.0415, lng: 121.5525, category: 'rehab', careRecipientId: careRecipientIds[4] })
  await ensureServicePoint({ name: '劉爺爺心臟科', address: '國泰綜合醫院心臟內科門診', lat: 25.0335, lng: 121.5515, category: 'hospital', careRecipientId: careRecipientIds[4] })
  await ensureServicePoint({ name: '劉爺爺藥局', address: '台北市大安區仁愛路四段20號', lat: 25.0375, lng: 121.5495, category: 'other', careRecipientId: careRecipientIds[4] })
  // 王奶奶（general，仁愛）
  await ensureServicePoint({ name: '王奶奶日照中心', address: '台北市信義區松仁路60號', lat: 25.0345, lng: 121.5685, category: 'other', careRecipientId: careRecipientIds[5] })
  await ensureServicePoint({ name: '王奶奶回診室', address: '台北市信義區基隆路一段333號', lat: 25.0395, lng: 121.5645, category: 'hospital', careRecipientId: careRecipientIds[5] })
  // 趙伯伯（general，仁愛）
  await ensureServicePoint({ name: '趙伯伯神經科', address: '台北榮民總醫院神經科門診', lat: 25.1215, lng: 121.5165, category: 'hospital', careRecipientId: careRecipientIds[6] })
  await ensureServicePoint({ name: '趙伯伯日間照護', address: '台北市松山區民生東路五段16號', lat: 25.0585, lng: 121.5615, category: 'other', careRecipientId: careRecipientIds[6] })
  // 周阿嬤（wheelchair，仁愛）
  await ensureServicePoint({ name: '周阿嬤復健科', address: '台北市內湖區成功路五段1號', lat: 25.0785, lng: 121.5865, category: 'rehab', careRecipientId: careRecipientIds[7] })
  await ensureServicePoint({ name: '周阿嬤洗腎中心', address: '台北市內湖區瑞光路258號', lat: 25.0815, lng: 121.5795, category: 'hospital', careRecipientId: careRecipientIds[7] })
  await ensureServicePoint({ name: '周阿嬤中醫診所', address: '台北市內湖區成功路四段30號', lat: 25.0795, lng: 121.5885, category: 'other', careRecipientId: careRecipientIds[7] })

  // recurringSchedules 用的據點位置（保持與舊 seed 相容）
  const servicePoints = [
    { address: '台北市中正區常德街1號', lat: 25.0405, lng: 121.5185 }, // [0] 台大醫院
    { address: '台北市北投區石牌路二段201號', lat: 25.1215, lng: 121.5165 }, // [1] 榮總
    { address: '台北市中山區南京東路二段50號', lat: 25.0525, lng: 121.5315 }, // [2] 陽光復健
    { address: '台北市大安區仁愛路四段10號', lat: 25.0375, lng: 121.5505 }, // [3] 仁愛日照
  ]
  void [spNtu, spVgh, spSunRehab, spRenaiDay] // IDs available if needed

  // ── 7. 週期性排程 ───────────────────────────────────────
  console.log('\n📅 建立週期性排程...')
  const recurringSchedules = [
    {
      // 陳爺爺：每週一三五早上去台大醫院洗腎（但陳爺爺是 general，這裡模擬復健）
      careRecipientId: careRecipientIds[0],
      organizationId: orgIds[0],
      daysOfWeek: JSON.stringify([1, 3, 5]),
      departureTime: '08:00',
      originAddress: careRecipients[0].address,
      originLat: careRecipients[0].lat,
      originLng: careRecipients[0].lng,
      destinationAddress: servicePoints[0].address,
      destinationLat: servicePoints[0].lat,
      destinationLng: servicePoints[0].lng,
      needsWheelchair: false,
      notes: '陳爺爺固定復健，08:00 出發至台大醫院',
      effectiveStartDate: '2026-03-01',
      effectiveEndDate: '2026-06-30',
      estimatedDuration: 30,
    },
    {
      // 林奶奶：每週二四六早上去台大醫院洗腎
      careRecipientId: careRecipientIds[1],
      organizationId: orgIds[0],
      daysOfWeek: JSON.stringify([2, 4, 6]),
      departureTime: '07:30',
      originAddress: careRecipients[1].address,
      originLat: careRecipients[1].lat,
      originLng: careRecipients[1].lng,
      destinationAddress: servicePoints[0].address,
      destinationLat: servicePoints[0].lat,
      destinationLng: servicePoints[0].lng,
      needsWheelchair: true,
      notes: '林奶奶固定洗腎，需輪椅車',
      effectiveStartDate: '2026-03-01',
      effectiveEndDate: '2026-06-30',
      estimatedDuration: 35,
    },
    {
      // 劉爺爺：每週一三五下午去復健中心
      careRecipientId: careRecipientIds[4],
      organizationId: orgIds[1],
      daysOfWeek: JSON.stringify([1, 3, 5]),
      departureTime: '13:30',
      originAddress: careRecipients[4].address,
      originLat: careRecipients[4].lat,
      originLng: careRecipients[4].lng,
      destinationAddress: servicePoints[2].address,
      destinationLat: servicePoints[2].lat,
      destinationLng: servicePoints[2].lng,
      needsWheelchair: true,
      notes: '劉爺爺固定復健，需輪椅車，電動輪椅較重',
      effectiveStartDate: '2026-03-01',
      effectiveEndDate: '2026-06-30',
      estimatedDuration: 40,
    },
    {
      // 王奶奶：每週二四去日間照護
      careRecipientId: careRecipientIds[5],
      organizationId: orgIds[1],
      daysOfWeek: JSON.stringify([2, 4]),
      departureTime: '08:30',
      originAddress: careRecipients[5].address,
      originLat: careRecipients[5].lat,
      originLng: careRecipients[5].lng,
      destinationAddress: servicePoints[3].address,
      destinationLat: servicePoints[3].lat,
      destinationLng: servicePoints[3].lng,
      needsWheelchair: false,
      notes: '王奶奶日間照護，需提前 10 分鐘到',
      effectiveStartDate: '2026-03-01',
      effectiveEndDate: '2026-06-30',
      estimatedDuration: 25,
    },
  ]

  for (const rs of recurringSchedules) {
    const existing = await db.select({ id: schema.recurringSchedules.id })
      .from(schema.recurringSchedules)
      .where(eq(schema.recurringSchedules.careRecipientId, rs.careRecipientId))
      .limit(1)
    const cr = careRecipients[careRecipientIds.indexOf(rs.careRecipientId)]
    if (existing.length > 0) {
      console.log(`  ⏭  ${cr.name} schedule already exists`)
      continue
    }
    await db.insert(schema.recurringSchedules).values({
      id: crypto.randomUUID(), ...rs,
      originLat: String(rs.originLat), originLng: String(rs.originLng),
      destinationLat: String(rs.destinationLat), destinationLng: String(rs.destinationLng),
    })
    console.log(`  ✅ ${cr.name} - ${rs.departureTime} (${rs.daysOfWeek})`)
  }

  // ── 8. 今日訂單（trips） ────────────────────────────────
  console.log('\n🚕 建立今日訂單...')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function todayAt(hour: number, minute: number): Date {
    const d = new Date(today)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  const trips = [
    {
      // Trip 1：陳爺爺 08:00 去台大 — 已指派，待出車
      careRecipientId: careRecipientIds[0],
      vehicleId: vehicleIds[0],        // ABC-1234 廂型車
      driverUserId: driverUserIds[0],   // 陳大偉
      status: 'assigned' as const,
      scheduledAt: todayAt(8, 0),
      scheduledEndAt: todayAt(8, 30),
      originAddress: careRecipients[0].address,
      originLat: careRecipients[0].lat,
      originLng: careRecipients[0].lng,
      destinationAddress: servicePoints[0].address,
      destinationLat: servicePoints[0].lat,
      destinationLng: servicePoints[0].lng,
      needsWheelchair: false,
      estimatedDuration: 30,
      notes: '陳爺爺早上復健',
    },
    {
      // Trip 2：林奶奶 07:30 去台大洗腎 — 進行中
      careRecipientId: careRecipientIds[1],
      vehicleId: vehicleIds[1],        // DEF-5678 輪椅車
      driverUserId: driverUserIds[1],   // 林志明
      status: 'in_progress' as const,
      scheduledAt: todayAt(7, 30),
      scheduledEndAt: todayAt(8, 5),
      originAddress: careRecipients[1].address,
      originLat: careRecipients[1].lat,
      originLng: careRecipients[1].lng,
      destinationAddress: servicePoints[0].address,
      destinationLat: servicePoints[0].lat,
      destinationLng: servicePoints[0].lng,
      needsWheelchair: true,
      estimatedDuration: 35,
      notes: '林奶奶洗腎，需輪椅車',
    },
    {
      // Trip 3：黃伯伯 09:00 去榮總 — 待派車
      careRecipientId: careRecipientIds[2],
      vehicleId: null,
      driverUserId: null,
      status: 'pending' as const,
      scheduledAt: todayAt(9, 0),
      scheduledEndAt: todayAt(10, 0),
      originAddress: careRecipients[2].address,
      originLat: careRecipients[2].lat,
      originLng: careRecipients[2].lng,
      destinationAddress: servicePoints[1].address,
      destinationLat: servicePoints[1].lat,
      destinationLng: servicePoints[1].lng,
      needsWheelchair: false,
      estimatedDuration: 45,
      notes: '黃伯伯臨時門診',
    },
    {
      // Trip 4：張阿嬤 10:00 去台大 — 待派車（臥床，需特殊車）
      careRecipientId: careRecipientIds[3],
      vehicleId: null,
      driverUserId: null,
      status: 'pending' as const,
      scheduledAt: todayAt(10, 0),
      scheduledEndAt: todayAt(10, 45),
      originAddress: careRecipients[3].address,
      originLat: careRecipients[3].lat,
      originLng: careRecipients[3].lng,
      destinationAddress: servicePoints[0].address,
      destinationLat: servicePoints[0].lat,
      destinationLng: servicePoints[0].lng,
      needsWheelchair: true,
      estimatedDuration: 45,
      notes: '張阿嬤臥床個案，需擔架車',
    },
    {
      // Trip 5：劉爺爺 13:30 去復健 — 已指派
      careRecipientId: careRecipientIds[4],
      vehicleId: vehicleIds[3],        // JKL-3456 輪椅車
      driverUserId: driverUserIds[1],   // 林志明（下午班）
      status: 'assigned' as const,
      scheduledAt: todayAt(13, 30),
      scheduledEndAt: todayAt(14, 10),
      originAddress: careRecipients[4].address,
      originLat: careRecipients[4].lat,
      originLng: careRecipients[4].lng,
      destinationAddress: servicePoints[2].address,
      destinationLat: servicePoints[2].lat,
      destinationLng: servicePoints[2].lng,
      needsWheelchair: true,
      estimatedDuration: 40,
      notes: '劉爺爺下午復健',
    },
    {
      // Trip 6：王奶奶 08:30 去日照中心 — 已完成
      careRecipientId: careRecipientIds[5],
      vehicleId: vehicleIds[2],        // GHI-9012 轎車
      driverUserId: driverUserIds[2],   // 吳建國
      status: 'completed' as const,
      scheduledAt: todayAt(8, 30),
      scheduledEndAt: todayAt(8, 55),
      originAddress: careRecipients[5].address,
      originLat: careRecipients[5].lat,
      originLng: careRecipients[5].lng,
      destinationAddress: servicePoints[3].address,
      destinationLat: servicePoints[3].lat,
      destinationLng: servicePoints[3].lng,
      needsWheelchair: false,
      estimatedDuration: 25,
      notes: '王奶奶日照接送',
    },
    {
      // Trip 7：趙伯伯 14:00 去榮總 — 待派車
      careRecipientId: careRecipientIds[6],
      vehicleId: null,
      driverUserId: null,
      status: 'pending' as const,
      scheduledAt: todayAt(14, 0),
      scheduledEndAt: todayAt(15, 0),
      originAddress: careRecipients[6].address,
      originLat: careRecipients[6].lat,
      originLng: careRecipients[6].lng,
      destinationAddress: servicePoints[1].address,
      destinationLat: servicePoints[1].lat,
      destinationLng: servicePoints[1].lng,
      needsWheelchair: false,
      estimatedDuration: 50,
      notes: '趙伯伯回診，有輕微失智請注意',
    },
    {
      // Trip 8：周阿嬤 15:00 去復健 — 待派車（輪椅）
      careRecipientId: careRecipientIds[7],
      vehicleId: null,
      driverUserId: null,
      status: 'pending' as const,
      scheduledAt: todayAt(15, 0),
      scheduledEndAt: todayAt(15, 40),
      originAddress: careRecipients[7].address,
      originLat: careRecipients[7].lat,
      originLng: careRecipients[7].lng,
      destinationAddress: servicePoints[2].address,
      destinationLat: servicePoints[2].lat,
      destinationLng: servicePoints[2].lng,
      needsWheelchair: true,
      estimatedDuration: 40,
      notes: '周阿嬤下午復健，手動輪椅',
    },
    {
      // Trip 9：陳爺爺 16:00 從台大返家 — 待派車（回程）
      careRecipientId: careRecipientIds[0],
      vehicleId: null,
      driverUserId: null,
      status: 'pending' as const,
      scheduledAt: todayAt(16, 0),
      scheduledEndAt: todayAt(16, 30),
      originAddress: servicePoints[0].address,
      originLat: servicePoints[0].lat,
      originLng: servicePoints[0].lng,
      destinationAddress: careRecipients[0].address,
      destinationLat: careRecipients[0].lat,
      destinationLng: careRecipients[0].lng,
      needsWheelchair: false,
      estimatedDuration: 30,
      notes: '陳爺爺回程',
    },
    {
      // Trip 10：昨天已完成的訂單（用於歷史紀錄/報表）
      careRecipientId: careRecipientIds[5],
      vehicleId: vehicleIds[2],
      driverUserId: driverUserIds[2],
      status: 'completed' as const,
      scheduledAt: new Date(today.getTime() - 86400000 + 8 * 3600000 + 30 * 60000), // 昨天 08:30
      scheduledEndAt: new Date(today.getTime() - 86400000 + 8 * 3600000 + 55 * 60000),
      originAddress: careRecipients[5].address,
      originLat: careRecipients[5].lat,
      originLng: careRecipients[5].lng,
      destinationAddress: servicePoints[3].address,
      destinationLat: servicePoints[3].lat,
      destinationLng: servicePoints[3].lng,
      needsWheelchair: false,
      estimatedDuration: 25,
      mileageEstimated: 8.5,
      mileageActual: 9.2,
      notes: '昨日王奶奶日照接送',
    },
  ]

  const tripIds: string[] = []
  // Trips don't have a natural unique key — skip if today's trips already seeded
  const existingTripCount = await db.$count(schema.trips)
  if (existingTripCount > 0) {
    console.log(`  ⏭  Trips already seeded (${existingTripCount} rows), skipping`)
    // Still populate tripIds for status logs by fetching today's trips ordered by scheduledAt
    const existingTrips = await db.select({ id: schema.trips.id })
      .from(schema.trips).orderBy(schema.trips.scheduledAt)
    existingTrips.forEach(r => tripIds.push(r.id))
  } else {
    for (const t of trips) {
      const orgId = careRecipients[careRecipientIds.indexOf(t.careRecipientId)]?.organizationId
      const [row] = await db.insert(schema.trips).values({
        id: crypto.randomUUID(), ...t,
        organizationId: orgId ?? null,
        originLat: t.originLat != null ? String(t.originLat) : null,
        originLng: t.originLng != null ? String(t.originLng) : null,
        destinationLat: t.destinationLat != null ? String(t.destinationLat) : null,
        destinationLng: t.destinationLng != null ? String(t.destinationLng) : null,
        mileageEstimated: (t as any).mileageEstimated != null ? String((t as any).mileageEstimated) : undefined,
        mileageActual: (t as any).mileageActual != null ? String((t as any).mileageActual) : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).returning({ id: schema.trips.id })
      tripIds.push(row.id)
      const cr = careRecipients[careRecipientIds.indexOf(t.careRecipientId)]
      const statusLabel = { pending: '待派車', assigned: '已指派', in_progress: '進行中', completed: '已完成', cancelled: '已取消' }
      console.log(`  ✅ ${cr.name} ${t.scheduledAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} [${statusLabel[t.status]}]`)
    }
  }

  // ── 9. 行程狀態紀錄（Trip 2 林奶奶進行中的狀態） ────────
  console.log('\n📝 建立行程狀態紀錄...')
  const trip2Logs = [
    { tripId: tripIds[1], driverUserId: driverUserIds[1], status: 'departed' as const, timestamp: todayAt(7, 25), lat: 25.0305, lng: 121.5145 },
    { tripId: tripIds[1], driverUserId: driverUserIds[1], status: 'arrived_origin' as const, timestamp: todayAt(7, 30), lat: 25.0305, lng: 121.5145 },
    { tripId: tripIds[1], driverUserId: driverUserIds[1], status: 'recipient_boarded' as const, timestamp: todayAt(7, 35), lat: 25.0305, lng: 121.5145 },
  ]

  for (const log of trip2Logs) {
    await db.insert(schema.tripStatusLogs).values({
      id: crypto.randomUUID(),
      ...log,
    })
  }
  console.log(`  ✅ Trip 2 (林奶奶) 已記錄 3 筆狀態`)

  // Trip 6 王奶奶已完成的完整狀態紀錄
  const trip6Logs = [
    { tripId: tripIds[5], driverUserId: driverUserIds[2], status: 'departed' as const, timestamp: todayAt(8, 20), lat: 25.0355, lng: 121.5675 },
    { tripId: tripIds[5], driverUserId: driverUserIds[2], status: 'arrived_origin' as const, timestamp: todayAt(8, 30), lat: 25.0355, lng: 121.5675 },
    { tripId: tripIds[5], driverUserId: driverUserIds[2], status: 'recipient_boarded' as const, timestamp: todayAt(8, 33), lat: 25.0355, lng: 121.5675 },
    { tripId: tripIds[5], driverUserId: driverUserIds[2], status: 'completed' as const, timestamp: todayAt(8, 55), lat: 25.0375, lng: 121.5505 },
  ]

  for (const log of trip6Logs) {
    await db.insert(schema.tripStatusLogs).values({
      id: crypto.randomUUID(),
      ...log,
    })
  }
  console.log(`  ✅ Trip 6 (王奶奶) 已記錄 4 筆完整狀態`)

  // ── 10. 公告 ────────────────────────────────────────────
  console.log('\n📢 建立公告...')

  // 取得 admin user id
  const [adminUser] = await db.select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, 'admin@bgmotion.com.tw'))
    .limit(1)

  if (adminUser) {
    const announcements = [
      {
        title: '本週車輛保養通知',
        body: 'ABC-1234 將於本週五下午進行定期保養，當日下午該車輛暫停服務，請司機提前確認行程安排。',
        authorUserId: adminUser.id,
        isPublished: true,
        publishedAt: new Date(),
        expiresAt: new Date(today.getTime() + 7 * 86400000),
      },
      {
        title: '新進司機張正義報到',
        body: '歡迎新進司機張正義加入團隊！張司機目前負責一般接送任務，尚未取得輪椅車駕駛資格。各位前輩請多指教。',
        authorUserId: adminUser.id,
        isPublished: true,
        publishedAt: new Date(),
        expiresAt: null,
      },
      {
        title: '端午節排班調整（草稿）',
        body: '端午連假期間（6/25-6/28）將採輪班制，詳細排班表稍後公布。',
        authorUserId: adminUser.id,
        isPublished: false,
        publishedAt: null,
        expiresAt: null,
      },
    ]

    for (const a of announcements) {
      await db.insert(schema.announcements).values({
        id: crypto.randomUUID(),
        ...a,
      })
      console.log(`  ✅ ${a.title} (${a.isPublished ? '已發布' : '草稿'})`)
    }
  }

  // ── 完成 ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✨ 測試資料建立完成！')
  console.log('═'.repeat(60))
  console.log(`
📊 資料摘要：
  • 機構：${orgs.length} 間
  • 機構人員：2 位
  • 車輛：${vehicles.length} 台（含 ${vehicles.filter(v => v.hasWheelchairLift).length} 台輪椅車）
  • 司機：${drivers.length} 位（${drivers.filter(d => d.canDriveWheelchairVan).length} 位可駕駛輪椅車）
  • 照護個案：${careRecipients.length} 位
  • 服務據點：${servicePoints.length} 個
  • 週期性排程：${recurringSchedules.length} 筆
  • 今日訂單：${trips.length} 筆
  • 公告：3 則

🔑 測試帳號：
  管理員：admin@bgmotion.com.tw / Aa3345678
  機構人員：staff-sunlight@test.com / Test1234
  機構人員：staff-renai@test.com / Test1234
  司機：driver-chen@test.com / Driver123
  司機：driver-lin@test.com / Driver123
  司機：driver-wu@test.com / Driver123
  司機：driver-zhang@test.com / Driver123
`)
}

await seedTestData()
await client.end()
