import { useDb } from '../infrastructure/db/drizzle'
import { announcements, user } from '../infrastructure/db/schema'
import { eq, and, isNull, gt, or } from 'drizzle-orm'

export interface AnnouncementCreateData {
  title: string
  body: string
  authorUserId: string
  expiresAt?: string | Date
}

export interface AnnouncementUpdateData {
  title?: string
  body?: string
  expiresAt?: string | Date | null
}

export function useAnnouncementServices() {
  const db = useDb()

  const list = async (filter: { publishedOnly?: boolean; includeExpired?: boolean }) => {
    const conditions = []

    if (filter.publishedOnly) {
      conditions.push(eq(announcements.isPublished, true))
    }

    if (!filter.includeExpired) {
      // only include items where expiresAt IS NULL or expiresAt > now
      conditions.push(
        or(
          isNull(announcements.expiresAt),
          gt(announcements.expiresAt, new Date())
        )
      )
    }

    return db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        isPublished: announcements.isPublished,
        publishedAt: announcements.publishedAt,
        expiresAt: announcements.expiresAt,
        authorUserId: announcements.authorUserId,
        authorName: user.name,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
      })
      .from(announcements)
      .leftJoin(user, eq(announcements.authorUserId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(announcements.createdAt)
  }

  const getById = async (id: string) => {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        isPublished: announcements.isPublished,
        publishedAt: announcements.publishedAt,
        expiresAt: announcements.expiresAt,
        authorUserId: announcements.authorUserId,
        authorName: user.name,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
      })
      .from(announcements)
      .leftJoin(user, eq(announcements.authorUserId, user.id))
      .where(eq(announcements.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  const create = async (data: AnnouncementCreateData) => {
    const inserted = await db
      .insert(announcements)
      .values({
        title: data.title,
        body: data.body,
        authorUserId: data.authorUserId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isPublished: false,
      })
      .returning()

    return inserted[0]
  }

  const update = async (id: string, data: AnnouncementUpdateData) => {
    type DbUpdate = {
      title?: string
      body?: string
      expiresAt?: Date | null
    }

    const updateValues: DbUpdate = {}
    if (data.title !== undefined) updateValues.title = data.title
    if (data.body !== undefined) updateValues.body = data.body
    if (data.expiresAt !== undefined) updateValues.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

    if (Object.keys(updateValues).length === 0) {
      return getById(id)
    }

    const updated = await db
      .update(announcements)
      .set(updateValues)
      .where(eq(announcements.id, id))
      .returning()

    return updated[0] ?? null
  }

  const publish = async (id: string) => {
    const updated = await db
      .update(announcements)
      .set({ isPublished: true, publishedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning()

    return updated[0] ?? null
  }

  const unpublish = async (id: string) => {
    const updated = await db
      .update(announcements)
      .set({ isPublished: false })
      .where(eq(announcements.id, id))
      .returning()

    return updated[0] ?? null
  }

  const remove = async (id: string) => {
    await db.delete(announcements).where(eq(announcements.id, id))
  }

  return { list, getById, create, update, publish, unpublish, remove }
}
