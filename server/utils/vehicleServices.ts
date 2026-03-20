import { useDb } from '../infrastructure/db/drizzle'
import { vehicles } from '../infrastructure/db/schema'
import { eq, ilike, or, and, desc } from 'drizzle-orm'

export function useVehicleServices() {
  const db = useDb()

  return {
    list: async (filter: { search?: string; activeOnly?: boolean }) => {
      const { search, activeOnly = true } = filter
      const conditions = []

      if (activeOnly) {
        conditions.push(eq(vehicles.isActive, true))
      }

      if (search) {
        conditions.push(
          or(
            ilike(vehicles.plate, `%${search}%`),
            ilike(vehicles.vehicleType, `%${search}%`)
          )
        )
      }

      return db
        .select()
        .from(vehicles)
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

    create: async (data: {
      plate: string
      vehicleType: string
      seatCount?: number
      hasWheelchairLift?: boolean
      wheelchairCapacity?: number
      notes?: string
    }) => {
      const rows = await db
        .insert(vehicles)
        .values({
          plate: data.plate,
          vehicleType: data.vehicleType,
          seatCount: data.seatCount ?? 4,
          hasWheelchairLift: data.hasWheelchairLift ?? false,
          wheelchairCapacity: data.wheelchairCapacity ?? 0,
          notes: data.notes,
        })
        .returning()
      return rows[0]
    },

    update: async (
      id: string,
      data: Partial<{
        plate: string
        vehicleType: string
        seatCount: number
        hasWheelchairLift: boolean
        wheelchairCapacity: number
        notes: string
      }>
    ) => {
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
