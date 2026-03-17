import type { IDriverTripCommandRepository, IDriverTripQueryRepository } from '../../domain/trips/ITripRepository'
import type { TripLogStatus, TripStatus, TripWithDetails } from '../../domain/trips/TripEntity'

const STATUS_TRANSITIONS: Record<TripStatus, TripLogStatus | null> = {
  pending: null,
  assigned: 'departed',
  in_progress: null, // further progress tracked via logs
  completed: null,
  cancelled: null,
}

const LOG_TO_TRIP_STATUS: Partial<Record<TripLogStatus, TripStatus>> = {
  departed: 'in_progress',
  completed: 'completed',
}

export interface UpdateStatusDto {
  logStatus: TripLogStatus
  lat?: string
  lng?: string
  mileageActual?: string
}

export class DriverTripService {
  constructor(
    private readonly query: IDriverTripQueryRepository,
    private readonly command: IDriverTripCommandRepository
  ) {}

  async getTripsForDate(driverUserId: string, date: Date): Promise<TripWithDetails[]> {
    console.log(`[DriverTripService] getTripsForDate driver=${driverUserId} date=${date.toISOString().split('T')[0]}`)
    const trips = await this.query.getDriverTripsForDate(driverUserId, date)
    console.log(`[DriverTripService] found ${trips.length} trips`)
    return trips
  }

  async getTripDetail(id: string, driverUserId: string): Promise<TripWithDetails> {
    console.log(`[DriverTripService] getTripDetail trip=${id} driver=${driverUserId}`)
    const trip = await this.query.getTripById(id, driverUserId)
    if (!trip) {
      console.warn(`[DriverTripService] trip=${id} not found for driver=${driverUserId}`)
      throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
    }
    return trip
  }

  async getTripHistory(driverUserId: string, page: number): Promise<TripWithDetails[]> {
    const limit = 20
    const offset = (page - 1) * limit
    console.log(`[DriverTripService] getTripHistory driver=${driverUserId} page=${page} offset=${offset}`)
    const trips = await this.query.getDriverTripHistory(driverUserId, limit, offset)
    console.log(`[DriverTripService] found ${trips.length} history trips`)
    return trips
  }

  async updateStatus(id: string, driverUserId: string, dto: UpdateStatusDto): Promise<void> {
    console.log(`[DriverTripService] updateStatus trip=${id} driver=${driverUserId} logStatus=${dto.logStatus}`)
    const trip = await this.query.getTripById(id, driverUserId)
    if (!trip) {
      console.warn(`[DriverTripService] trip=${id} not found`)
      throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
    }

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      console.warn(`[DriverTripService] trip=${id} already finished (${trip.status})`)
      throw createError({ statusCode: 400, statusMessage: 'Trip is already finished' })
    }

    await this.command.addStatusLog({
      tripId: id,
      driverUserId,
      status: dto.logStatus,
      lat: dto.lat,
      lng: dto.lng,
    })
    console.log(`[DriverTripService] status log added trip=${id} status=${dto.logStatus}`)

    const newTripStatus = LOG_TO_TRIP_STATUS[dto.logStatus]
    if (newTripStatus) {
      await this.command.updateTripStatus(id, newTripStatus)
      console.log(`[DriverTripService] trip=${id} status updated to ${newTripStatus}`)
    }

    if (dto.logStatus === 'completed' && dto.mileageActual) {
      await this.command.updateMileageActual(id, dto.mileageActual)
      console.log(`[DriverTripService] trip=${id} mileageActual=${dto.mileageActual}`)
    }
  }
}
