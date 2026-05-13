import { useDb } from '../infrastructure/db/drizzle'
import { fleets } from '../infrastructure/db/schema'
import { eq, asc } from 'drizzle-orm'

export interface FleetCreateData {
  name: string
  contactPerson?: string | null
  phone?: string | null
  address?: string | null
  taxId?: string | null
  notes?: string | null
}

export type FleetUpdateData = Partial<FleetCreateData> & { isActive?: boolean }

export function useFleetServices() {
  const db = useDb()

  return {
    listActive: async () => {
      return db.select().from(fleets).where(eq(fleets.isActive, true)).orderBy(asc(fleets.name))
    },

    listAll: async () => {
      return db.select().from(fleets).orderBy(asc(fleets.name))
    },

    getById: async (id: string) => {
      const rows = await db.select().from(fleets).where(eq(fleets.id, id)).limit(1)
      return rows[0] ?? null
    },

    create: async (data: FleetCreateData) => {
      const rows = await db.insert(fleets).values({
        name: data.name,
        contactPerson: data.contactPerson ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        taxId: data.taxId ?? null,
        notes: data.notes ?? null,
      }).returning()
      return rows[0]!
    },

    update: async (id: string, data: FleetUpdateData) => {
      const rows = await db.update(fleets).set(data).where(eq(fleets.id, id)).returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Fleet not found' })
      }
      return rows[0]!
    },

    softDelete: async (id: string) => {
      await db.update(fleets).set({ isActive: false }).where(eq(fleets.id, id))
    },
  }
}
