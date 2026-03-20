import crypto from 'crypto'
import { useDb } from '../infrastructure/db/drizzle'
import { user, driverProfiles } from '../infrastructure/db/schema'
import { eq, and, or, ilike } from 'drizzle-orm'

export interface DriverListFilter {
  search?: string
  status?: string
}

export interface DriverCreateData {
  name: string
  email: string
  phone: string
  licenseExpiry?: string
  emergencyContact?: string
  emergencyPhone?: string
  canDriveWheelchairVan?: boolean
}

export interface DriverUpdateData {
  phone?: string
  licenseExpiry?: string
  isActive?: boolean
  status?: 'active' | 'on_leave' | 'resigned'
  unavailableDates?: string
  emergencyContact?: string
  emergencyPhone?: string
  canDriveWheelchairVan?: boolean
}

export async function listDrivers(filter: DriverListFilter) {
  const db = useDb()

  const rows = await db
    .select({
      id: driverProfiles.id,
      userId: driverProfiles.userId,
      phone: driverProfiles.phone,
      licenseExpiry: driverProfiles.licenseExpiry,
      isActive: driverProfiles.isActive,
      status: driverProfiles.status,
      unavailableDates: driverProfiles.unavailableDates,
      emergencyContact: driverProfiles.emergencyContact,
      emergencyPhone: driverProfiles.emergencyPhone,
      canDriveWheelchairVan: driverProfiles.canDriveWheelchairVan,
      userName: user.name,
      userEmail: user.email,
    })
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .where(
      and(
        filter.status ? eq(driverProfiles.status, filter.status as 'active' | 'on_leave' | 'resigned') : undefined,
        filter.search
          ? or(
              ilike(user.name, `%${filter.search}%`),
              ilike(driverProfiles.phone, `%${filter.search}%`),
            )
          : undefined,
      ),
    )

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    phone: row.phone,
    licenseExpiry: row.licenseExpiry,
    isActive: row.isActive,
    status: row.status,
    unavailableDates: row.unavailableDates,
    emergencyContact: row.emergencyContact,
    emergencyPhone: row.emergencyPhone,
    canDriveWheelchairVan: row.canDriveWheelchairVan,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
    },
  }))
}

export async function getDriverById(id: string) {
  const db = useDb()

  const rows = await db
    .select({
      id: driverProfiles.id,
      userId: driverProfiles.userId,
      phone: driverProfiles.phone,
      licenseExpiry: driverProfiles.licenseExpiry,
      isActive: driverProfiles.isActive,
      status: driverProfiles.status,
      unavailableDates: driverProfiles.unavailableDates,
      emergencyContact: driverProfiles.emergencyContact,
      emergencyPhone: driverProfiles.emergencyPhone,
      canDriveWheelchairVan: driverProfiles.canDriveWheelchairVan,
      userName: user.name,
      userEmail: user.email,
    })
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .where(eq(driverProfiles.id, id))
    .limit(1)

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.id,
    userId: row.userId,
    phone: row.phone,
    licenseExpiry: row.licenseExpiry,
    isActive: row.isActive,
    status: row.status,
    unavailableDates: row.unavailableDates,
    emergencyContact: row.emergencyContact,
    emergencyPhone: row.emergencyPhone,
    canDriveWheelchairVan: row.canDriveWheelchairVan,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
    },
  }
}

export async function createDriver(data: DriverCreateData) {
  const db = useDb()

  const userId = crypto.randomUUID()

  await db.insert(user).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: false,
    role: 'driver',
    banned: false,
    subscriptionTier: 'free',
    lastNotifiedTier: 'free',
  })

  const profileId = crypto.randomUUID()
  await db.insert(driverProfiles).values({
    id: profileId,
    userId,
    phone: data.phone,
    licenseExpiry: data.licenseExpiry ?? null,
    emergencyContact: data.emergencyContact ?? null,
    emergencyPhone: data.emergencyPhone ?? null,
    canDriveWheelchairVan: data.canDriveWheelchairVan ?? false,
  })

  return getDriverById(profileId)
}

export async function updateDriver(id: string, data: DriverUpdateData) {
  const db = useDb()

  type DriverProfileUpdate = {
    phone?: string
    licenseExpiry?: string | null
    isActive?: boolean
    status?: 'active' | 'on_leave' | 'resigned'
    unavailableDates?: string | null
    emergencyContact?: string | null
    emergencyPhone?: string | null
    canDriveWheelchairVan?: boolean
  }

  const updateValues: DriverProfileUpdate = {}
  if (data.phone !== undefined) updateValues.phone = data.phone
  if (data.licenseExpiry !== undefined) updateValues.licenseExpiry = data.licenseExpiry
  if (data.isActive !== undefined) updateValues.isActive = data.isActive
  if (data.status !== undefined) updateValues.status = data.status
  if (data.unavailableDates !== undefined) updateValues.unavailableDates = data.unavailableDates
  if (data.emergencyContact !== undefined) updateValues.emergencyContact = data.emergencyContact
  if (data.emergencyPhone !== undefined) updateValues.emergencyPhone = data.emergencyPhone
  if (data.canDriveWheelchairVan !== undefined) updateValues.canDriveWheelchairVan = data.canDriveWheelchairVan

  if (Object.keys(updateValues).length === 0) {
    return getDriverById(id)
  }

  await db.update(driverProfiles).set(updateValues).where(eq(driverProfiles.id, id))

  return getDriverById(id)
}

export async function deactivateDriver(id: string) {
  const db = useDb()
  await db.update(driverProfiles).set({ isActive: false }).where(eq(driverProfiles.id, id))
}
