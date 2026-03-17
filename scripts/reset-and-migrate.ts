/**
 * 清除舊 drizzle migration 紀錄，重新從當前 schema 產生乾淨的 migration 並執行。
 * 適用於 DB 是全新環境（docker 剛啟動）。
 *
 * 使用方式：npm run db:reset
 */
import { execSync } from 'node:child_process'
import { rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const drizzleDir = './drizzle'
const metaDir = join(drizzleDir, 'meta')

// 1. 清除所有 .sql migration 檔
console.log('🗑  Clearing old migration SQL files...')
for (const file of readdirSync(drizzleDir)) {
  if (file.endsWith('.sql')) {
    rmSync(join(drizzleDir, file))
    console.log(`   removed: ${file}`)
  }
}

// 2. 清除 meta snapshot，並寫入空 journal
console.log('🗑  Clearing drizzle meta snapshots...')
rmSync(metaDir, { recursive: true, force: true })
mkdirSync(metaDir, { recursive: true })
writeFileSync(
  join(metaDir, '_journal.json'),
  JSON.stringify({ version: '7', dialect: 'postgresql', entries: [] }, null, 2)
)

// 3. 重新產生 migration（非互動式，無舊 snapshot 就不會問 rename）
console.log('\n⚙️  Generating fresh migration from current schema...')
execSync('npx drizzle-kit generate', { stdio: 'inherit' })

// 4. 執行 migration
console.log('\n🚀  Running migration...')
execSync('npm run db:migrate', { stdio: 'inherit' })

console.log('\n✅  Done! Database is ready.')
