import { useDb } from '../infrastructure/db/drizzle'
import { vehicles, user } from '../infrastructure/db/schema'
import { eq, ilike, or, and, desc } from 'drizzle-orm'

export interface VehicleCreateData {
  driverUserId: string
  plate: string
  vehicleType: string
  seatCount?: number
  wheelchairCapacity?: number
  isAccessible?: boolean
  isRental?: boolean
  homeAddress?: string | null
  homeLat?: string | null
  homeLng?: string | null
  vehiclePhotoKey?: string | null
  vehicleRegistrationKey?: string | null
  compulsoryInsurer?: string | null
  insuranceExpiry?: string | null
  hasThirdPartyLiability?: boolean
  hasPassengerLiability?: boolean
  hasDriverInjury?: boolean
  hasExcessLiability?: boolean
  notes?: string | null
}

export type VehicleUpdateData = Partial<Omit<VehicleCreateData, 'driverUserId'>> & { isActive?: boolean }

export function useVehicleServices() {
  const db = useDb()

  return {
    list: async (filter: { search?: string; activeOnly?: boolean }) => {
      const { search, activeOnly = true } = filter
      const conditions = []
      if (activeOnly) conditions.push(eq(vehicles.isActive, true))
      if (search) {
        conditions.push(
          or(
            ilike(vehicles.plate, `%${search}%`),
            ilike(vehicles.vehicleType, `%${search}%`),
          ),
        )
      }

      return db
        .select({
          id: vehicles.id,
          driverUserId: vehicles.driverUserId,
          plate: vehicles.plate,
          vehicleType: vehicles.vehicleType,
          seatCount: vehicles.seatCount,
          wheelchairCapacity: vehicles.wheelchairCapacity,
          isAccessible: vehicles.isAccessible,
          isRental: vehicles.isRental,
          homeAddress: vehicles.homeAddress,
          homeLat: vehicles.homeLat,
          homeLng: vehicles.homeLng,
          isActive: vehicles.isActive,
          notes: vehicles.notes,
          createdAt: vehicles.createdAt,
          driverName: user.name,
          driverEmail: user.email,
        })
        .from(vehicles)
        .leftJoin(user, eq(vehicles.driverUserId, user.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(vehicles.createdAt))
    },

    getById: async (id: string) => {
      const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
      }
      return rows[0]
    },

    getByDriverUserId: async (driverUserId: string) => {
      const rows = await db.select().from(vehicles).where(eq(vehicles.driverUserId, driverUserId)).limit(1)
      return rows[0] ?? null
    },

    create: async (data: VehicleCreateData) => {
      const rows = await db
        .insert(vehicles)
        .values({
          driverUserId: data.driverUserId,
          plate: data.plate,
          vehicleType: data.vehicleType,
          seatCount: data.seatCount ?? 4,
          wheelchairCapacity: data.wheelchairCapacity ?? 0,
          isAccessible: data.isAccessible ?? false,
          isRental: data.isRental ?? false,
          homeAddress: data.homeAddress ?? null,
          homeLat: data.homeLat ?? null,
          homeLng: data.homeLng ?? null,
          vehiclePhotoKey: data.vehiclePhotoKey ?? null,
          vehicleRegistrationKey: data.vehicleRegistrationKey ?? null,
          compulsoryInsurer: data.compulsoryInsurer ?? null,
          insuranceExpiry: data.insuranceExpiry ?? null,
          hasThirdPartyLiability: data.hasThirdPartyLiability ?? false,
          hasPassengerLiability: data.hasPassengerLiability ?? false,
          hasDriverInjury: data.hasDriverInjury ?? false,
          hasExcessLiability: data.hasExcessLiability ?? false,
          notes: data.notes ?? null,
        })
        .returning()
      return rows[0]
    },

    update: async (id: string, data: VehicleUpdateData) => {
      const rows = await db
        .update(vehicles)
        .set(data)
        .where(eq(vehicles.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
      }
      return rows[0]
    },

    upsertForDriver: async (driverUserId: string, data: Omit<VehicleCreateData, 'driverUserId'>) => {
      const existing = await db.select().from(vehicles).where(eq(vehicles.driverUserId, driverUserId)).limit(1)
      if (existing.length === 0) {
        return await db.insert(vehicles).values({ ...data, driverUserId, seatCount: data.seatCount ?? 4 }).returning().then(r => r[0])
      }
      const rows = await db
        .update(vehicles)
        .set(data)
        .where(eq(vehicles.driverUserId, driverUserId))
        .returning()
      return rows[0]
    },

    softDelete: async (id: string) => {
      const rows = await db
        .update(vehicles)
        .set({ isActive: false })
        .where(eq(vehicles.id, id))
        .returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
      }
      return rows[0]
    },
  }
}
