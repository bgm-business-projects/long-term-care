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

  console.log('\n✨ Seed complete.')
}

await seed()
await client.end()
