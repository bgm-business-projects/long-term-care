/**
 * Seed 預設帳號
 * 使用方式：npm run db:seed
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

// ── 與 Better Auth 相同的 scrypt 設定 ─────────────────────
async function hashPassword(password: string): Promise<string> {
  const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)))
  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${hex.encode(key)}`
}

// ── Seed 資料 ──────────────────────────────────────────────
const SEED_USERS = [
  {
    email: 'admin@bgmotion.com.tw',
    name: 'Admin',
    password: 'Aa3345678',
    role: 'admin',
  },
]

async function seed() {
  console.log('🌱 Seeding users...\n')

  for (const u of SEED_USERS) {
    // 檢查是否已存在
    const existing = await db.select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, u.email))
      .limit(1)

    if (existing.length > 0) {
      console.log(`⏭  ${u.email} already exists, skipping`)
      continue
    }

    const userId = crypto.randomUUID()
    const hashedPassword = await hashPassword(u.password)
    const now = new Date()

    // 建立 user 記錄
    await db.insert(schema.user).values({
      id: userId,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      banned: false,
      subscriptionTier: 'free',
      lastNotifiedTier: 'free',
      consentAcceptedAt: now,
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    // 建立 credential account 記錄
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    })

    console.log(`✅ Created ${u.role}: ${u.email}`)
  }

  // 預設平台共用輔具（organizationId=null）
  console.log('\n🦽 Seeding default assistive devices...')
  const DEFAULT_DEVICES = [
    { name: '輪椅', description: '一般手動輪椅' },
    { name: '電動輪椅', description: '電動輪椅，較重需升降設備' },
    { name: '擔架', description: '臥床個案使用' },
    { name: '氧氣瓶', description: '需氧氣支援的個案' },
    { name: '移位機', description: '輔助上下車' },
    { name: '助行器', description: '能自行行走但需扶持' },
  ]
  for (const d of DEFAULT_DEVICES) {
    const existing = await db.select({ id: schema.assistiveDevices.id })
      .from(schema.assistiveDevices)
      .where(eq(schema.assistiveDevices.name, d.name))
      .limit(1)
    if (existing.length > 0) {
      console.log(`⏭  ${d.name} already exists, skipping`)
      continue
    }
    await db.insert(schema.assistiveDevices).values({
      id: crypto.randomUUID(),
      name: d.name,
      description: d.description,
      organizationId: null,
    })
    console.log(`✅ Created device: ${d.name}`)
  }

  // 預設平台共用特殊需求
  console.log('\n🩺 Seeding default special needs...')
  const DEFAULT_SPECIAL_NEEDS = [
    { name: '一般', description: '無特殊需求' },
    { name: '輕度失智', description: '需提醒、避免複雜對話' },
    { name: '重度失智', description: '需專人陪同、易迷向' },
    { name: '會自行走動', description: '失智但手腳健全可能會亂跑，需特別注記' },
    { name: '長期臥床', description: '需司機協助搬下床，行程時間會加長，不建議長者或較弱小司機' },
    { name: '視障', description: '需引導動作' },
    { name: '聽障', description: '請大聲說話或筆談' },
  ]
  for (const sn of DEFAULT_SPECIAL_NEEDS) {
    const existing = await db.select({ id: schema.specialNeeds.id })
      .from(schema.specialNeeds)
      .where(eq(schema.specialNeeds.name, sn.name))
      .limit(1)
    if (existing.length > 0) {
      console.log(`⏭  ${sn.name} already exists, skipping`)
      continue
    }
    await db.insert(schema.specialNeeds).values({
      id: crypto.randomUUID(),
      name: sn.name,
      description: sn.description,
      organizationId: null,
    })
    console.log(`✅ Created special need: ${sn.name}`)
  }

  console.log('\n✨ Seed complete.')
}

await seed()
await client.end()
