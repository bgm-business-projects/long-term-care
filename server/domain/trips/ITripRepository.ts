import type { TripLogStatus, TripStatus, TripWithDetails } from './TripEntity'

export interface IDriverTripQueryRepository {
  getDriverTripsForDate(driverUserId: string, date: Date): Promise<TripWithDetails[]>
  getTripById(id: string, driverUserId: string): Promise<TripWithDetails | null>
  getDriverTripHistory(driverUserId: string, limit: number, offset: number): Promise<TripWithDetails[]>
}

export interface CreateStatusLogDto {
  tripId: string
  driverUserId: string
  status: TripLogStatus
  lat?: string
  lng?: string
  note?: string
}

export interface IDriverTripCommandRepository {
  updateTripStatus(id: string, status: TripStatus): Promise<void>
  addStatusLog(dto: CreateStatusLogDto): Promise<void>
  updateMileageActual(id: string, mileageActual: string): Promise<void>
}
