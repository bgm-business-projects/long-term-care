import crypto from 'crypto'
import { useDb } from '../infrastructure/db/drizzle'
import { user, driverProfiles, fleets, vehicles } from '../infrastructure/db/schema'
import { eq, and, or, ilike } from 'drizzle-orm'

export interface DriverListFilter {
  search?: string
  status?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  fleetId?: string
}

export interface DriverCreateData {
  name: string
  email: string
  phone: string
  fleetId?: string | null
  licenseExpiry?: string
  emergencyContact?: string
  emergencyPhone?: string
}

export interface DriverUpdateData {
  phone?: string
  fleetId?: string | null
  licenseExpiry?: string | null
  isActive?: boolean
  status?: 'active' | 'on_leave' | 'resigned'
  unavailableDates?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
}

const DRIVER_SELECT = {
  id: driverProfiles.id,
  userId: driverProfiles.userId,
  fleetId: driverProfiles.fleetId,
  phone: driverProfiles.phone,
  termsAcceptedAt: driverProfiles.termsAcceptedAt,
  idCardFrontKey: driverProfiles.idCardFrontKey,
  idCardBackKey: driverProfiles.idCardBackKey,
  professionalLicenseKey: driverProfiles.professionalLicenseKey,
  licenseExpiry: driverProfiles.licenseExpiry,
  approvalStatus: driverProfiles.approvalStatus,
  approvedAt: driverProfiles.approvedAt,
  rejectionReason: driverProfiles.rejectionReason,
  isActive: driverProfiles.isActive,
  status: driverProfiles.status,
  unavailableDates: driverProfiles.unavailableDates,
  emergencyContact: driverProfiles.emergencyContact,
  emergencyPhone: driverProfiles.emergencyPhone,
  createdAt: driverProfiles.createdAt,
  userName: user.name,
  userEmail: user.email,
  fleetName: fleets.name,
} as const

function shapeDriver(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.userId,
    fleetId: row.fleetId,
    phone: row.phone,
    termsAcceptedAt: row.termsAcceptedAt,
    idCardFrontKey: row.idCardFrontKey,
    idCardBackKey: row.idCardBackKey,
    professionalLicenseKey: row.professionalLicenseKey,
    licenseExpiry: row.licenseExpiry,
    approvalStatus: row.approvalStatus,
    approvedAt: row.approvedAt,
    rejectionReason: row.rejectionReason,
    isActive: row.isActive,
    status: row.status,
    unavailableDates: row.unavailableDates,
    emergencyContact: row.emergencyContact,
    emergencyPhone: row.emergencyPhone,
    createdAt: row.createdAt,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
    },
    fleet: row.fleetId ? { id: row.fleetId, name: row.fleetName } : null,
  }
}

export async function listDrivers(filter: DriverListFilter) {
  const db = useDb()

  const rows = await db
    .select(DRIVER_SELECT)
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
    .where(
      and(
        filter.status ? eq(driverProfiles.status, filter.status as 'active' | 'on_leave' | 'resigned') : undefined,
        filter.approvalStatus ? eq(driverProfiles.approvalStatus, filter.approvalStatus) : undefined,
        filter.fleetId ? eq(driverProfiles.fleetId, filter.fleetId) : undefined,
        filter.search
          ? or(
              ilike(user.name, `%${filter.search}%`),
              ilike(driverProfiles.phone, `%${filter.search}%`),
            )
          : undefined,
      ),
    )

  return rows.map(shapeDriver)
}

export async function getDriverById(id: string) {
  const db = useDb()

  const rows = await db
    .select(DRIVER_SELECT)
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
    .where(eq(driverProfiles.id, id))
    .limit(1)

  return rows[0] ? shapeDriver(rows[0]) : null
}

export async function getDriverByUserId(userId: string) {
  const db = useDb()

  const rows = await db
    .select(DRIVER_SELECT)
    .from(driverProfiles)
    .innerJoin(user, eq(driverProfiles.userId, user.id))
    .leftJoin(fleets, eq(driverProfiles.fleetId, fleets.id))
    .where(eq(driverProfiles.userId, userId))
    .limit(1)

  return rows[0] ? shapeDriver(rows[0]) : null
}

export async function getDriverWithVehicle(userId: string) {
  const db = useDb()
  const driver = await getDriverByUserId(userId)
  if (!driver) return null

  const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.driverUserId, userId)).limit(1)
  return { driver, vehicle: vehicleRows[0] ?? null }
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
    fleetId: data.fleetId ?? null,
    phone: data.phone,
    licenseExpiry: data.licenseExpiry ?? null,
    emergencyContact: data.emergencyContact ?? null,
    emergencyPhone: data.emergencyPhone ?? null,
  })

  return getDriverById(profileId)
}

export async function updateDriver(id: string, data: DriverUpdateData) {
  const db = useDb()

  const updateValues: Record<string, unknown> = {}
  if (data.phone !== undefined) updateValues.phone = data.phone
  if (data.fleetId !== undefined) updateValues.fleetId = data.fleetId
  if (data.licenseExpiry !== undefined) updateValues.licenseExpiry = data.licenseExpiry
  if (data.isActive !== undefined) updateValues.isActive = data.isActive
  if (data.status !== undefined) updateValues.status = data.status
  if (data.unavailableDates !== undefined) updateValues.unavailableDates = data.unavailableDates
  if (data.emergencyContact !== undefined) updateValues.emergencyContact = data.emergencyContact
  if (data.emergencyPhone !== undefined) updateValues.emergencyPhone = data.emergencyPhone

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
