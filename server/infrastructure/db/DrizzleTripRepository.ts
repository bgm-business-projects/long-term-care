import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { useDb } from './drizzle'
import { careRecipients, tripStatusLogs, trips } from './schema'
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
  createdAt: trips.createdAt,
  updatedAt: trips.updatedAt,
  // care_recipients (prefixed to avoid collision)
  recipientId: careRecipients.id,
  recipientName: careRecipients.name,
  recipientAddress: careRecipients.address,
  recipientContactPerson: careRecipients.contactPerson,
  recipientContactPhone: careRecipients.contactPhone,
  recipientSpecialNeeds: careRecipients.specialNeeds,
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

    return rows.map(row => rowToTripWithDetails(row, allLogs.filter(l => l.tripId === row.id)))
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

    return rowToTripWithDetails(rows[0], logs)
  }

  async getDriverTripHistory(driverUserId: string, limit: number, offset: number): Promise<TripWithDetails[]> {
    const rows = await this.db
      .select(tripWithRecipientFields)
      .from(trips)
      .innerJoin(careRecipients, eq(trips.careRecipientId, careRecipients.id))
      .where(eq(trips.driverUserId, driverUserId))
      .orderBy(desc(trips.scheduledAt))
      .limit(limit)
      .offset(offset)

    const tripIds = rows.map(r => r.id)
    const allLogs = tripIds.length > 0
      ? await this.db.select().from(tripStatusLogs)
          .where(inArray(tripStatusLogs.tripId, tripIds))
          .orderBy(tripStatusLogs.timestamp)
      : []

    return rows.map(row => rowToTripWithDetails(row, allLogs.filter(l => l.tripId === row.id)))
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
  logs: (typeof tripStatusLogs.$inferSelect)[]
): TripWithDetails {
  return {
    id: row.id,
    careRecipientId: row.careRecipientId,
    vehicleId: row.vehicleId,
    driverUserId: row.driverUserId,
    organizationId: row.organizationId,
    scheduledAt: row.scheduledAt,
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    careRecipient: {
      id: row.recipientId,
      name: row.recipientName,
      address: row.recipientAddress,
      contactPerson: row.recipientContactPerson,
      contactPhone: row.recipientContactPhone,
      specialNeeds: row.recipientSpecialNeeds,
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
