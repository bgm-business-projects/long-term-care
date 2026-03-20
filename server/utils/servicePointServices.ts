import { useDb } from '../infrastructure/db/drizzle'
import { servicePoints } from '../infrastructure/db/schema'
import { eq, ilike, and, isNull, or, desc } from 'drizzle-orm'

type ServicePointCategory = 'hospital' | 'rehab' | 'other'

export function useServicePointServices() {
  const db = useDb()

  return {
    /**
     * 列出據點。scope 說明：
     * - scope='global'         → 只有 organizationId=null & careRecipientId=null（admin 用）
     * - scope='org'            → 只有指定 organizationId 的機構據點
     * - scope='careRecipient'  → 只有指定 careRecipientId 的個案據點
     * - scope='order'          → 全域 + 指定 org + 指定 careRecipient（建立訂單時選擇用）
     * - 不帶 scope             → 全部（admin 管理用）
     */
    list: async (filter: {
      search?: string
      category?: ServicePointCategory
      scope?: 'global' | 'org' | 'careRecipient' | 'order'
      organizationId?: string
      careRecipientId?: string
    }) => {
      const { search, category, scope, organizationId, careRecipientId } = filter
      const conditions = []

      if (scope === 'global') {
        conditions.push(isNull(servicePoints.organizationId))
        conditions.push(isNull(servicePoints.careRecipientId))
      } else if (scope === 'org' && organizationId) {
        conditions.push(eq(servicePoints.organizationId, organizationId))
        conditions.push(isNull(servicePoints.careRecipientId))
      } else if (scope === 'careRecipient' && careRecipientId) {
        conditions.push(eq(servicePoints.careRecipientId, careRecipientId))
      } else if (scope === 'order') {
        // 全域 OR 指定機構 OR 指定個案
        const orConditions = [
          and(isNull(servicePoints.organizationId), isNull(servicePoints.careRecipientId)),
          ...(organizationId ? [and(eq(servicePoints.organizationId, organizationId), isNull(servicePoints.careRecipientId))] : []),
          ...(careRecipientId ? [eq(servicePoints.careRecipientId, careRecipientId)] : []),
        ]
        conditions.push(or(...orConditions))
      }

      if (search) {
        conditions.push(ilike(servicePoints.name, `%${search}%`))
      }

      if (category) {
        conditions.push(eq(servicePoints.category, category))
      }

      return db
        .select()
        .from(servicePoints)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(servicePoints.createdAt))
    },

    getById: async (id: string) => {
      const rows = await db.select().from(servicePoints).where(eq(servicePoints.id, id)).limit(1)
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Service point not found' })
      }
      return rows[0]
    },

    create: async (data: {
      name: string
      address: string
      lat?: string
      lng?: string
      category?: ServicePointCategory
      organizationId?: string | null
      careRecipientId?: string | null
    }) => {
      const rows = await db
        .insert(servicePoints)
        .values({
          name: data.name,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          category: data.category ?? 'other',
          organizationId: data.organizationId ?? null,
          careRecipientId: data.careRecipientId ?? null,
        })
        .returning()
      return rows[0]
    },

    update: async (
      id: string,
      data: Partial<{
        name: string
        address: string
        lat: string
        lng: string
        category: ServicePointCategory
      }>
    ) => {
      const rows = await db
        .update(servicePoints)
        .set(data)
        .where(eq(servicePoints.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Service point not found' })
      }
      return rows[0]
    },

    delete: async (id: string) => {
      const rows = await db
        .delete(servicePoints)
        .where(eq(servicePoints.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Service point not found' })
      }
      return rows[0]
    },
  }
}
