import { useDb } from '../infrastructure/db/drizzle'
import { specialNeeds, careRecipientSpecialNeeds } from '../infrastructure/db/schema'
import { eq, and, or, isNull, asc, inArray } from 'drizzle-orm'

export interface SpecialNeedCreateData {
  name: string
  description?: string | null
  organizationId?: string | null
}

export type SpecialNeedUpdateData = Partial<SpecialNeedCreateData> & { isActive?: boolean }

export function useSpecialNeedServices() {
  const db = useDb()

  return {
    listForOrganization: async (organizationId: string | null) => {
      const where = organizationId
        ? and(eq(specialNeeds.isActive, true), or(isNull(specialNeeds.organizationId), eq(specialNeeds.organizationId, organizationId)))
        : eq(specialNeeds.isActive, true)
      return db.select().from(specialNeeds).where(where).orderBy(asc(specialNeeds.name))
    },

    listAll: async () => {
      return db.select().from(specialNeeds).orderBy(asc(specialNeeds.name))
    },

    create: async (data: SpecialNeedCreateData) => {
      const rows = await db.insert(specialNeeds).values({
        name: data.name,
        description: data.description ?? null,
        organizationId: data.organizationId ?? null,
      }).returning()
      return rows[0]!
    },

    update: async (id: string, data: SpecialNeedUpdateData) => {
      const rows = await db.update(specialNeeds).set(data).where(eq(specialNeeds.id, id)).returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Special need not found' })
      }
      return rows[0]!
    },

    softDelete: async (id: string) => {
      await db.update(specialNeeds).set({ isActive: false }).where(eq(specialNeeds.id, id))
    },

    listForRecipient: async (recipientId: string) => {
      const rows = await db
        .select({ id: specialNeeds.id, name: specialNeeds.name, description: specialNeeds.description })
        .from(careRecipientSpecialNeeds)
        .innerJoin(specialNeeds, eq(careRecipientSpecialNeeds.specialNeedId, specialNeeds.id))
        .where(eq(careRecipientSpecialNeeds.careRecipientId, recipientId))
      return rows
    },

    setRecipientSpecialNeeds: async (recipientId: string, specialNeedIds: string[]) => {
      await db.delete(careRecipientSpecialNeeds).where(eq(careRecipientSpecialNeeds.careRecipientId, recipientId))
      if (specialNeedIds.length > 0) {
        await db.insert(careRecipientSpecialNeeds).values(specialNeedIds.map(specialNeedId => ({ careRecipientId: recipientId, specialNeedId })))
      }
    },

    listForRecipients: async (recipientIds: string[]) => {
      if (recipientIds.length === 0) return new Map<string, { id: string; name: string }[]>()
      const rows = await db
        .select({ recipientId: careRecipientSpecialNeeds.careRecipientId, id: specialNeeds.id, name: specialNeeds.name })
        .from(careRecipientSpecialNeeds)
        .innerJoin(specialNeeds, eq(careRecipientSpecialNeeds.specialNeedId, specialNeeds.id))
        .where(inArray(careRecipientSpecialNeeds.careRecipientId, recipientIds))
      const map = new Map<string, { id: string; name: string }[]>()
      for (const r of rows) {
        const list = map.get(r.recipientId) ?? []
        list.push({ id: r.id, name: r.name })
        map.set(r.recipientId, list)
      }
      return map
    },
  }
}
