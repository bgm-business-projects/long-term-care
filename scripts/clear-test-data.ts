/**
 * 清除所有測試資料（保留 admin/developer 帳號）
 * 使用方式：npx tsx --env-file=.env scripts/clear-test-data.ts
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { inArray, notInArray } from 'drizzle-orm'
import * as schema from '../server/infrastructure/db/schema'

const databaseUrl = process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('❌ NUXT_DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client, { schema })

async function clearTestData() {
  console.log('🗑  清除測試資料...\n')

  await db.delete(schema.tripStatusLogs)
  console.log('  ✅ trip_status_logs')

  await db.delete(schema.trips)
  console.log('  ✅ trips')

  await db.delete(schema.recurringSchedules)
  console.log('  ✅ recurring_schedules')

  await db.delete(schema.careRecipients)
  console.log('  ✅ care_recipients')

  await db.delete(schema.servicePoints)
  console.log('  ✅ service_points')

  await db.delete(schema.announcements)
  console.log('  ✅ announcements')

  await db.delete(schema.driverProfiles)
  console.log('  ✅ driver_profiles')

  await db.delete(schema.vehicles)
  console.log('  ✅ vehicles')

  await db.delete(schema.organizations)
  console.log('  ✅ organizations')

  // 找出非 admin/developer 的 user
  const testUsers = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(notInArray(schema.user.role as any, ['admin', 'developer']))

  if (testUsers.length > 0) {
    const ids = testUsers.map(u => u.id)
    await db.delete(schema.account).where(inArray(schema.account.userId, ids))
    await db.delete(schema.user).where(inArray(schema.user.id, ids))
    console.log(`  ✅ users (${ids.length} 筆測試帳號)`)
  }

  console.log('\n✨ 完成！現在可執行：npm run db:seed && npm run db:seed:test')
}

await clearTestData()
await client.end()
