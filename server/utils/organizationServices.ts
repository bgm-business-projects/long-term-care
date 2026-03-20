import { useDb } from '../infrastructure/db/drizzle'
import { organizations } from '../infrastructure/db/schema'
import { eq, ilike, desc } from 'drizzle-orm'

export function useOrganizationServices() {
  const db = useDb()

  return {
    list: async (filter: { search?: string }) => {
      const { search } = filter

      if (search) {
        return db
          .select()
          .from(organizations)
          .where(ilike(organizations.name, `%${search}%`))
          .orderBy(desc(organizations.createdAt))
      }

      return db.select().from(organizations).orderBy(desc(organizations.createdAt))
    },

    getById: async (id: string) => {
      const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
      }
      return rows[0]
    },

    create: async (data: {
      name: string
      contactPerson?: string
      phone?: string
      address?: string
    }) => {
      const rows = await db
        .insert(organizations)
        .values({
          name: data.name,
          contactPerson: data.contactPerson,
          phone: data.phone,
          address: data.address,
        })
        .returning()
      return rows[0]
    },

    update: async (
      id: string,
      data: Partial<{
        name: string
        contactPerson: string
        phone: string
        address: string
      }>
    ) => {
      const rows = await db
        .update(organizations)
        .set(data)
        .where(eq(organizations.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
      }
      return rows[0]
    },

    delete: async (id: string) => {
      const rows = await db
        .delete(organizations)
        .where(eq(organizations.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
      }
      return rows[0]
    },
  }
}
