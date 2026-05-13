import { useDb } from '../infrastructure/db/drizzle'
import { careRecipients, organizations } from '../infrastructure/db/schema'
import { eq, and, ilike } from 'drizzle-orm'

export interface CareRecipientListFilter {
  search?: string
  organizationId?: string
  activeOnly?: boolean
}

export interface CareRecipientCreateData {
  organizationId?: string
  name: string
  address: string
  lat?: string
  lng?: string
  contactPerson?: string
  contactPhone?: string
  notes?: string
}

export interface CareRecipientUpdateData {
  organizationId?: string
  name?: string
  address?: string
  lat?: string
  lng?: string
  contactPerson?: string
  contactPhone?: string
  notes?: string
  isActive?: boolean
}

export async function listCareRecipients(filter: CareRecipientListFilter) {
  const db = useDb()

  const conditions = []

  if (filter.organizationId) {
    conditions.push(eq(careRecipients.organizationId, filter.organizationId))
  }

  if (filter.activeOnly) {
    conditions.push(eq(careRecipients.isActive, true))
  }

  if (filter.search) {
    conditions.push(ilike(careRecipients.name, `%${filter.search}%`))
  }

  const rows = await db
    .select({
      id: careRecipients.id,
      organizationId: careRecipients.organizationId,
      name: careRecipients.name,
      address: careRecipients.address,
      lat: careRecipients.lat,
      lng: careRecipients.lng,
      contactPerson: careRecipients.contactPerson,
      contactPhone: careRecipients.contactPhone,
      notes: careRecipients.notes,
      isActive: careRecipients.isActive,
      createdAt: careRecipients.createdAt,
      updatedAt: careRecipients.updatedAt,
      organizationName: organizations.name,
    })
    .from(careRecipients)
    .leftJoin(organizations, eq(careRecipients.organizationId, organizations.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return rows
}

export async function getCareRecipientById(id: string) {
  const db = useDb()

  const rows = await db
    .select()
    .from(careRecipients)
    .where(eq(careRecipients.id, id))
    .limit(1)

  if (rows.length === 0) {
    return null
  }

  return rows[0]
}

export async function createCareRecipient(data: CareRecipientCreateData) {
  const db = useDb()

  const inserted = await db
    .insert(careRecipients)
    .values({
      organizationId: data.organizationId ?? null,
      name: data.name,
      address: data.address,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      contactPerson: data.contactPerson ?? null,
      contactPhone: data.contactPhone ?? null,
      notes: data.notes ?? null,
    })
    .returning()

  return inserted[0]
}

export async function updateCareRecipient(id: string, data: CareRecipientUpdateData) {
  const db = useDb()

  type CareRecipientDbUpdate = {
    organizationId?: string | null
    name?: string
    address?: string
    lat?: string | null
    lng?: string | null
    contactPerson?: string | null
    contactPhone?: string | null
      notes?: string | null
    isActive?: boolean
  }

  const updateValues: CareRecipientDbUpdate = {}
  if (data.organizationId !== undefined) updateValues.organizationId = data.organizationId
  if (data.name !== undefined) updateValues.name = data.name
  if (data.address !== undefined) updateValues.address = data.address
  if (data.lat !== undefined) updateValues.lat = data.lat
  if (data.lng !== undefined) updateValues.lng = data.lng
  if (data.contactPerson !== undefined) updateValues.contactPerson = data.contactPerson
  if (data.contactPhone !== undefined) updateValues.contactPhone = data.contactPhone
  if (data.notes !== undefined) updateValues.notes = data.notes
  if (data.isActive !== undefined) updateValues.isActive = data.isActive

  if (Object.keys(updateValues).length === 0) {
    return getCareRecipientById(id)
  }

  const updated = await db
    .update(careRecipients)
    .set(updateValues)
    .where(eq(careRecipients.id, id))
    .returning()

  return updated[0] ?? null
}

export async function softDeleteCareRecipient(id: string) {
  const db = useDb()
  await db.update(careRecipients).set({ isActive: false }).where(eq(careRecipients.id, id))
}
