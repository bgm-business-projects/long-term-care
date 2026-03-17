import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let db: ReturnType<typeof createDrizzle> | undefined

function createDrizzle() {
  const config = useRuntimeConfig()
  const client = postgres(config.databaseUrl)

  return drizzle(client, { schema })
}

export function useDb() {
  if (!db) {
    db = createDrizzle()
  }
  return db
}
