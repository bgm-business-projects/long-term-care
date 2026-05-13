import { useDb } from '../infrastructure/db/drizzle'
import { assistiveDevices, careRecipientDevices, tripDevices } from '../infrastructure/db/schema'
import { eq, and, or, isNull, asc, inArray } from 'drizzle-orm'

export interface DeviceCreateData {
  name: string
  description?: string | null
  organizationId?: string | null
}

export type DeviceUpdateData = Partial<DeviceCreateData> & { isActive?: boolean }

export function useDeviceServices() {
  const db = useDb()

  return {
    // 平台 admin 看全部；機構人員看 (平台共用 OR 自己機構)
    listForOrganization: async (organizationId: string | null) => {
      const where = organizationId
        ? and(eq(assistiveDevices.isActive, true), or(isNull(assistiveDevices.organizationId), eq(assistiveDevices.organizationId, organizationId)))
        : eq(assistiveDevices.isActive, true)
      return db.select().from(assistiveDevices).where(where).orderBy(asc(assistiveDevices.name))
    },

    listAll: async () => {
      return db.select().from(assistiveDevices).orderBy(asc(assistiveDevices.name))
    },

    create: async (data: DeviceCreateData) => {
      const rows = await db.insert(assistiveDevices).values({
        name: data.name,
        description: data.description ?? null,
        organizationId: data.organizationId ?? null,
      }).returning()
      return rows[0]!
    },

    update: async (id: string, data: DeviceUpdateData) => {
      const rows = await db.update(assistiveDevices).set(data).where(eq(assistiveDevices.id, id)).returning()
      if (rows.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Device not found' })
      }
      return rows[0]!
    },

    softDelete: async (id: string) => {
      await db.update(assistiveDevices).set({ isActive: false }).where(eq(assistiveDevices.id, id))
    },

    // 個案輔具
    listForRecipient: async (recipientId: string) => {
      const rows = await db
        .select({ id: assistiveDevices.id, name: assistiveDevices.name })
        .from(careRecipientDevices)
        .innerJoin(assistiveDevices, eq(careRecipientDevices.deviceId, assistiveDevices.id))
        .where(eq(careRecipientDevices.careRecipientId, recipientId))
      return rows
    },

    setRecipientDevices: async (recipientId: string, deviceIds: string[]) => {
      await db.delete(careRecipientDevices).where(eq(careRecipientDevices.careRecipientId, recipientId))
      if (deviceIds.length > 0) {
        await db.insert(careRecipientDevices).values(deviceIds.map(deviceId => ({ careRecipientId: recipientId, deviceId })))
      }
    },

    // 訂單輔具
    listForTrip: async (tripId: string) => {
      const rows = await db
        .select({ id: assistiveDevices.id, name: assistiveDevices.name })
        .from(tripDevices)
        .innerJoin(assistiveDevices, eq(tripDevices.deviceId, assistiveDevices.id))
        .where(eq(tripDevices.tripId, tripId))
      return rows
    },

    setTripDevices: async (tripId: string, deviceIds: string[]) => {
      await db.delete(tripDevices).where(eq(tripDevices.tripId, tripId))
      if (deviceIds.length > 0) {
        await db.insert(tripDevices).values(deviceIds.map(deviceId => ({ tripId, deviceId })))
      }
    },

    listForTrips: async (tripIds: string[]) => {
      if (tripIds.length === 0) return new Map<string, { id: string; name: string }[]>()
      const rows = await db
        .select({ tripId: tripDevices.tripId, id: assistiveDevices.id, name: assistiveDevices.name })
        .from(tripDevices)
        .innerJoin(assistiveDevices, eq(tripDevices.deviceId, assistiveDevices.id))
        .where(inArray(tripDevices.tripId, tripIds))
      const map = new Map<string, { id: string; name: string }[]>()
      for (const r of rows) {
        const list = map.get(r.tripId) ?? []
        list.push({ id: r.id, name: r.name })
        map.set(r.tripId, list)
      }
      return map
    },
  }
}
