import postgres from 'postgres'
import { readFileSync } from 'fs'

const sqlContent = readFileSync(process.argv[2] || 'migration.sql', 'utf-8')

const databaseUrl = process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('NUXT_DATABASE_URL is not set')
  process.exit(1)
}

const client = postgres(databaseUrl)

// Remove comment lines, then split by semicolons
const cleaned = sqlContent.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n')
const statements = cleaned
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

for (const stmt of statements) {
  try {
    await client.unsafe(stmt)
    console.log('OK:', stmt.substring(0, 70) + '...')
  } catch (e) {
    console.error('ERR:', e.message)
    console.error('    Statement:', stmt.substring(0, 70))
  }
}

// Verify tables
const result = await client`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
console.log('\nTables in database:')
for (const row of result) {
  console.log(' -', row.tablename)
}

await client.end()
