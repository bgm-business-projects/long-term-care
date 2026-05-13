import { useDb } from '../infrastructure/db/drizzle'
import { trips, careRecipients, vehicles, user, organizations } from '../infrastructure/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'

export interface TripListFilter {
  date?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  organizationId?: string
  vehicleId?: string
  driverUserId?: string
}

export interface TripCreateData {
  careRecipientId: string
  scheduledAt: string
  originAddress: string
  originLat?: string
  originLng?: string
  destinationAddress: string
  destinationLat?: string
  destinationLng?: string
  needsWheelchair: boolean
  vehicleId?: string
  driverUserId?: string
  estimatedDuration?: number
  notes?: string
}

export interface TripUpdateData {
  careRecipientId?: string
  vehicleId?: string
  driverUserId?: string
  scheduledAt?: string
  scheduledEndAt?: string
  estimatedDuration?: number
  originAddress?: string
  originLat?: string
  originLng?: string
  destinationAddress?: string
  destinationLat?: string
  destinationLng?: string
  status?: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  mileageEstimated?: string
  mileageActual?: string
  needsWheelchair?: boolean
  notes?: string
}

const driverUser = user

export async function listTrips(filter: TripListFilter) {
  const db = useDb()

  const conditions = []

  if (filter.organizationId) {
    conditions.push(eq(trips.organizationId, filter.organizationId))
  }

  if (filter.status) {
    conditions.push(eq(trips.status, filter.status as 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'))
  }

  if (filter.vehicleId) {
    conditions.push(eq(trips.vehicleId, filter.vehicleId))
  }

  if (filter.driverUserId) {
    conditions.push(eq(trips.driverUserId, filter.driverUserId))
  }

  // 優先使用 dateFrom/dateTo 區間；若只給 date 則沿用單日
  if (filter.dateFrom || filter.dateTo) {
    if (filter.dateFrom) {
      const start = new Date(filter.dateFrom)
      start.setHours(0, 0, 0, 0)
      conditions.push(gte(trips.scheduledAt, start))
    }
    if (filter.dateTo) {
      const end = new Date(filter.dateTo)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(trips.scheduledAt, end))
    }
  } else if (filter.date) {
    const start = new Date(filter.date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(filter.date)
    end.setHours(23, 59, 59, 999)
    conditions.push(gte(trips.scheduledAt, start))
    conditions.push(lte(trips.scheduledAt, end))
  }

  const rows = await db
    .select({
      id: trips.id,
      careRecipientId: trips.careRecipientId,
      vehicleId: trips.vehicleId,
      driverUserId: trips.driverUserId,
      organizationId: trips.organizationId,
      scheduledAt: trips.scheduledAt,
      scheduledEndAt: trips.scheduledEndAt,
      estimatedDuration: trips.estimatedDuration,
      originAddress: trips.originAddress,
      originLat: trips.originLat,
      originLng: trips.originLng,
      destinationAddress: trips.destinationAddress,
      destinationLat: trips.destinationLat,
      destinationLng: trips.destinationLng,
      status: trips.status,
      mileageEstimated: trips.mileageEstimated,
      mileageActual: trips.mileageActual,
      needsWheelchair: trips.needsWheelchair,
      notes: trips.notes,
      recurringScheduleId: trips.recurringScheduleId,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
      careRecipientName: careRecipients.name,
      vehiclePlate: vehicles.plate,
      driverName: driverUser.name,
      organizationName: organizations.name,
    })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(driverUser, eq(trips.driverUserId, driverUser.id))
    .leftJoin(organizations, eq(trips.organizationId, organizations.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(trips.scheduledAt))

  return rows.map((row) => ({
    id: row.id,
    careRecipientId: row.careRecipientId,
    vehicleId: row.vehicleId,
    driverUserId: row.driverUserId,
    organizationId: row.organizationId,
    scheduledAt: row.scheduledAt,
    scheduledEndAt: row.scheduledEndAt,
    estimatedDuration: row.estimatedDuration,
    originAddress: row.originAddress,
    originLat: row.originLat,
    originLng: row.originLng,
    destinationAddress: row.destinationAddress,
    destinationLat: row.destinationLat,
    destinationLng: row.destinationLng,
    status: row.status,
    mileageEstimated: row.mileageEstimated,
    mileageActual: row.mileageActual,
    needsWheelchair: row.needsWheelchair,
    notes: row.notes,
    recurringScheduleId: row.recurringScheduleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    careRecipient: row.careRecipientName ? { name: row.careRecipientName } : null,
    vehicle: row.vehiclePlate ? { plate: row.vehiclePlate } : null,
    driver: row.driverName ? { name: row.driverName } : null,
    organization: row.organizationName ? { id: row.organizationId, name: row.organizationName } : null,
    source: row.organizationId ? 'organization' as const : 'platform' as const,
  }))
}

export async function getTripById(id: string) {
  const db = useDb()

  const rows = await db
    .select({
      id: trips.id,
      careRecipientId: trips.careRecipientId,
      vehicleId: trips.vehicleId,
      driverUserId: trips.driverUserId,
      organizationId: trips.organizationId,
      scheduledAt: trips.scheduledAt,
      scheduledEndAt: trips.scheduledEndAt,
      estimatedDuration: trips.estimatedDuration,
      originAddress: trips.originAddress,
      originLat: trips.originLat,
      originLng: trips.originLng,
      destinationAddress: trips.destinationAddress,
      destinationLat: trips.destinationLat,
      destinationLng: trips.destinationLng,
      status: trips.status,
      mileageEstimated: trips.mileageEstimated,
      mileageActual: trips.mileageActual,
      needsWheelchair: trips.needsWheelchair,
      notes: trips.notes,
      recurringScheduleId: trips.recurringScheduleId,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
      careRecipientName: careRecipients.name,
      careRecipientAddress: careRecipients.address,
      vehiclePlate: vehicles.plate,
      vehicleType: vehicles.vehicleType,
      driverName: driverUser.name,
      driverEmail: driverUser.email,
    })
    .from(trips)
    .leftJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .leftJoin(driverUser, eq(trips.driverUserId, driverUser.id))
    .where(eq(trips.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return null
  }
  return {
    id: row.id,
    careRecipientId: row.careRecipientId,
    vehicleId: row.vehicleId,
    driverUserId: row.driverUserId,
    organizationId: row.organizationId,
    scheduledAt: row.scheduledAt,
    scheduledEndAt: row.scheduledEndAt,
    estimatedDuration: row.estimatedDuration,
    originAddress: row.originAddress,
    originLat: row.originLat,
    originLng: row.originLng,
    destinationAddress: row.destinationAddress,
    destinationLat: row.destinationLat,
    destinationLng: row.destinationLng,
    status: row.status,
    mileageEstimated: row.mileageEstimated,
    mileageActual: row.mileageActual,
    needsWheelchair: row.needsWheelchair,
    notes: row.notes,
    recurringScheduleId: row.recurringScheduleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    careRecipient: row.careRecipientName
      ? {
          name: row.careRecipientName,
          address: row.careRecipientAddress,
        }
      : null,
    vehicle: row.vehiclePlate
      ? { plate: row.vehiclePlate, vehicleType: row.vehicleType }
      : null,
    driver: row.driverName
      ? { name: row.driverName, email: row.driverEmail }
      : null,
  }
}

export async function createTrip(data: TripCreateData) {
  const db = useDb()

  // Fetch organizationId from careRecipient
  const recipient = await db
    .select({ organizationId: careRecipients.organizationId })
    .from(careRecipients)
    .where(eq(careRecipients.id, data.careRecipientId))
    .limit(1)

  const organizationId = recipient[0]?.organizationId ?? null

  // 司機=車 1:1 — 若指定司機但未指定車輛，自動帶入司機的車
  let vehicleId = data.vehicleId ?? null
  if (data.driverUserId && !vehicleId) {
    const v = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.driverUserId, data.driverUserId)).limit(1)
    vehicleId = v[0]?.id ?? null
  }

  const scheduledAt = new Date(data.scheduledAt)

  let scheduledEndAt: Date | null = null
  if (data.estimatedDuration) {
    scheduledEndAt = new Date(scheduledAt.getTime() + data.estimatedDuration * 60 * 1000)
  }

  const status = vehicleId && data.driverUserId ? 'assigned' : 'pending'

  const inserted = await db
    .insert(trips)
    .values({
      careRecipientId: data.careRecipientId,
      organizationId,
      vehicleId,
      driverUserId: data.driverUserId ?? null,
      scheduledAt,
      scheduledEndAt,
      estimatedDuration: data.estimatedDuration ?? null,
      originAddress: data.originAddress,
      originLat: data.originLat ?? null,
      originLng: data.originLng ?? null,
      destinationAddress: data.destinationAddress,
      destinationLat: data.destinationLat ?? null,
      destinationLng: data.destinationLng ?? null,
      status,
      needsWheelchair: data.needsWheelchair,
      notes: data.notes ?? null,
    })
    .returning()

  if (!inserted[0]) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create trip' })
  }
  return getTripById(inserted[0].id)
}

export async function updateTrip(id: string, data: TripUpdateData) {
  const db = useDb()

  type TripDbUpdate = {
    careRecipientId?: string
    vehicleId?: string | null
    driverUserId?: string | null
    scheduledAt?: Date
    scheduledEndAt?: Date | null
    estimatedDuration?: number | null
    originAddress?: string
    originLat?: string | null
    originLng?: string | null
    destinationAddress?: string
    destinationLat?: string | null
    destinationLng?: string | null
    status?: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
    mileageEstimated?: string | null
    mileageActual?: string | null
    needsWheelchair?: boolean
    notes?: string | null
  }

  const updateValues: TripDbUpdate = {}

  if (data.careRecipientId !== undefined) updateValues.careRecipientId = data.careRecipientId
  if (data.vehicleId !== undefined) updateValues.vehicleId = data.vehicleId
  if (data.driverUserId !== undefined) {
    updateValues.driverUserId = data.driverUserId
    // 司機=車 1:1 — 換司機時，若 caller 未指定車輛，自動帶入司機的車
    if (data.driverUserId && data.vehicleId === undefined) {
      const v = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.driverUserId, data.driverUserId)).limit(1)
      updateValues.vehicleId = v[0]?.id ?? null
    }
  }
  if (data.scheduledAt !== undefined) updateValues.scheduledAt = new Date(data.scheduledAt)
  if (data.scheduledEndAt !== undefined) updateValues.scheduledEndAt = new Date(data.scheduledEndAt)
  if (data.estimatedDuration !== undefined) updateValues.estimatedDuration = data.estimatedDuration
  if (data.originAddress !== undefined) updateValues.originAddress = data.originAddress
  if (data.originLat !== undefined) updateValues.originLat = data.originLat
  if (data.originLng !== undefined) updateValues.originLng = data.originLng
  if (data.destinationAddress !== undefined) updateValues.destinationAddress = data.destinationAddress
  if (data.destinationLat !== undefined) updateValues.destinationLat = data.destinationLat
  if (data.destinationLng !== undefined) updateValues.destinationLng = data.destinationLng
  if (data.status !== undefined) updateValues.status = data.status
  if (data.mileageEstimated !== undefined) updateValues.mileageEstimated = data.mileageEstimated
  if (data.mileageActual !== undefined) updateValues.mileageActual = data.mileageActual
  if (data.needsWheelchair !== undefined) updateValues.needsWheelchair = data.needsWheelchair
  if (data.notes !== undefined) updateValues.notes = data.notes

  // Recalculate scheduledEndAt if estimatedDuration changed without explicit scheduledEndAt
  if (data.estimatedDuration !== undefined && data.scheduledAt !== undefined && data.scheduledEndAt === undefined) {
    const scheduledAt = new Date(data.scheduledAt)
    updateValues.scheduledEndAt = new Date(scheduledAt.getTime() + data.estimatedDuration * 60 * 1000)
  }

  if (Object.keys(updateValues).length > 0) {
    await db.update(trips).set(updateValues).where(eq(trips.id, id))
  }

  return getTripById(id)
}

export async function cancelTrip(id: string) {
  const db = useDb()
  await db.update(trips).set({ status: 'cancelled' }).where(eq(trips.id, id))
}
