import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { useDb } from './drizzle'
import {
  careRecipients,
  tripStatusLogs,
  trips,
  careRecipientSpecialNeeds,
  specialNeeds,
  careRecipientDevices,
  assistiveDevices,
} from './schema'
import type { IDriverTripCommandRepository, IDriverTripQueryRepository, CreateStatusLogDto } from '../../domain/trips/ITripRepository'
import type { TripStatus, TripWithDetails } from '../../domain/trips/TripEntity'

const tripWithRecipientFields = {
  // trips
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
  // 共乘 + 來回欄位
  carpoolGroupId: trips.carpoolGroupId,
  carpoolOrder: trips.carpoolOrder,
  carpoolPickupAt: trips.carpoolPickupAt,
  carpoolDropoffOrder: trips.carpoolDropoffOrder,
  carpoolDropoffAt: trips.carpoolDropoffAt,
  pairedTripId: trips.pairedTripId,
  tripDirection: trips.tripDirection,
  createdAt: trips.createdAt,
  updatedAt: trips.updatedAt,
  // care_recipients (prefixed to avoid collision)
  recipientId: careRecipients.id,
  recipientName: careRecipients.name,
  recipientAddress: careRecipients.address,
  recipientContactPerson: careRecipients.contactPerson,
  recipientContactPhone: careRecipients.contactPhone,
}

export class DrizzleTripRepository implements IDriverTripQueryRepository, IDriverTripCommandRepository {
  private get db() { return useDb() }

  async getDriverTripsForDate(driverUserId: string, date: Date): Promise<TripWithDetails[]> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const rows = await this.db
      .select(tripWithRecipientFields)
      .from(trips)
      .innerJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .where(and(
        eq(trips.driverUserId, driverUserId),
        gte(trips.scheduledAt, start),
        lt(trips.scheduledAt, end),
      ))
      .orderBy(trips.scheduledAt)

    const tripIds = rows.map(r => r.id)
    const allLogs = tripIds.length > 0
      ? await this.db.select().from(tripStatusLogs)
          .where(inArray(tripStatusLogs.tripId, tripIds))
          .orderBy(tripStatusLogs.timestamp)
      : []

    const recipientIds = Array.from(new Set(rows.map(r => r.recipientId)))
    const { needsMap, devicesMap } = await this.loadRecipientExtras(recipientIds)

    return rows.map(row => rowToTripWithDetails(
      row,
      allLogs.filter(l => l.tripId === row.id),
      needsMap.get(row.recipientId) ?? [],
      devicesMap.get(row.recipientId) ?? [],
    ))
  }

  async getTripById(id: string, driverUserId: string): Promise<TripWithDetails | null> {
    const rows = await this.db
      .select(tripWithRecipientFields)
      .from(trips)
      .innerJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .where(and(eq(trips.id, id), eq(trips.driverUserId, driverUserId)))
      .limit(1)

    if (rows.length === 0) return null

    const logs = await this.db
      .select()
      .from(tripStatusLogs)
      .where(eq(tripStatusLogs.tripId, id))
      .orderBy(tripStatusLogs.timestamp)

    const first = rows[0]!
    const { needsMap, devicesMap } = await this.loadRecipientExtras([first.recipientId])
    return rowToTripWithDetails(
      first,
      logs,
      needsMap.get(first.recipientId) ?? [],
      devicesMap.get(first.recipientId) ?? [],
    )
  }

  /**
   * 批次載入個案的特殊需求與輔具
   */
  private async loadRecipientExtras(recipientIds: string[]) {
    const needsMap = new Map<string, { id: string; name: string; description: string | null }[]>()
    const devicesMap = new Map<string, { id: string; name: string; description: string | null }[]>()
    if (recipientIds.length === 0) return { needsMap, devicesMap }

    const needRows = await this.db.select({
      careRecipientId: careRecipientSpecialNeeds.careRecipientId,
      id: specialNeeds.id,
      name: specialNeeds.name,
      description: specialNeeds.description,
    })
      .from(careRecipientSpecialNeeds)
      .innerJoin(specialNeeds, eq(careRecipientSpecialNeeds.specialNeedId, specialNeeds.id))
      .where(inArray(careRecipientSpecialNeeds.careRecipientId, recipientIds))

    for (const n of needRows) {
      const arr = needsMap.get(n.careRecipientId) ?? []
      arr.push({ id: n.id, name: n.name, description: n.description })
      needsMap.set(n.careRecipientId, arr)
    }

    const deviceRows = await this.db.select({
      careRecipientId: careRecipientDevices.careRecipientId,
      id: assistiveDevices.id,
      name: assistiveDevices.name,
      description: assistiveDevices.description,
    })
      .from(careRecipientDevices)
      .innerJoin(assistiveDevices, eq(careRecipientDevices.deviceId, assistiveDevices.id))
      .where(inArray(careRecipientDevices.careRecipientId, recipientIds))

    for (const d of deviceRows) {
      const arr = devicesMap.get(d.careRecipientId) ?? []
      arr.push({ id: d.id, name: d.name, description: d.description })
      devicesMap.set(d.careRecipientId, arr)
    }

    return { needsMap, devicesMap }
  }

  async getDriverTripHistory(
    driverUserId: string,
    limit: number,
    offset: number,
    dateRange?: { startDate: Date; endDate: Date },
  ): Promise<TripWithDetails[]> {
    // 歷史紀錄定義：已完成或已取消的行程（pending / assigned / in_progress 不算）
    const conditions = [
      eq(trips.driverUserId, driverUserId),
      inArray(trips.status, ['completed', 'cancelled']),
    ]
    if (dateRange) {
      conditions.push(gte(trips.scheduledAt, dateRange.startDate))
      conditions.push(lt(trips.scheduledAt, dateRange.endDate))
    }
    const rows = await this.db
      .select(tripWithRecipientFields)
      .from(trips)
      .innerJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .where(and(...conditions))
      .orderBy(desc(trips.scheduledAt))
      .limit(limit)
      .offset(offset)

    const tripIds = rows.map(r => r.id)
    const allLogs = tripIds.length > 0
      ? await this.db.select().from(tripStatusLogs)
          .where(inArray(tripStatusLogs.tripId, tripIds))
          .orderBy(tripStatusLogs.timestamp)
      : []

    const recipientIds = Array.from(new Set(rows.map(r => r.recipientId)))
    const { needsMap, devicesMap } = await this.loadRecipientExtras(recipientIds)

    return rows.map(row => rowToTripWithDetails(
      row,
      allLogs.filter(l => l.tripId === row.id),
      needsMap.get(row.recipientId) ?? [],
      devicesMap.get(row.recipientId) ?? [],
    ))
  }

  async updateTripStatus(id: string, status: TripStatus): Promise<void> {
    await this.db.update(trips).set({ status }).where(eq(trips.id, id))
  }

  async addStatusLog(dto: CreateStatusLogDto): Promise<void> {
    await this.db.insert(tripStatusLogs).values({
      tripId: dto.tripId,
      driverUserId: dto.driverUserId,
      status: dto.status,
      lat: dto.lat,
      lng: dto.lng,
      note: dto.note,
    })
  }

  async updateMileageActual(id: string, mileageActual: string): Promise<void> {
    await this.db.update(trips).set({ mileageActual }).where(eq(trips.id, id))
  }
}

function rowToTripWithDetails(
  row: Record<string, any>,
  logs: (typeof tripStatusLogs.$inferSelect)[],
  specialNeedsList: { id: string; name: string; description: string | null }[] = [],
  devices: { id: string; name: string; description: string | null }[] = [],
): TripWithDetails {
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
    carpoolGroupId: row.carpoolGroupId,
    carpoolOrder: row.carpoolOrder,
    carpoolPickupAt: row.carpoolPickupAt,
    carpoolDropoffOrder: row.carpoolDropoffOrder,
    carpoolDropoffAt: row.carpoolDropoffAt,
    pairedTripId: row.pairedTripId,
    tripDirection: row.tripDirection,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    careRecipient: {
      id: row.recipientId,
      name: row.recipientName,
      address: row.recipientAddress,
      contactPerson: row.recipientContactPerson,
      contactPhone: row.recipientContactPhone,
      specialNeeds: specialNeedsList,
      devices,
    },
    statusLogs: logs.map(l => ({
      id: l.id,
      status: l.status,
      timestamp: l.timestamp,
      lat: l.lat,
      lng: l.lng,
      note: l.note,
    })),
  }
}
