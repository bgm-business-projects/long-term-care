import { DrizzleTripRepository } from '../infrastructure/db/DrizzleTripRepository'
import { DriverTripService } from '../application/trips/DriverTripService'

export function useTripServices() {
  const repo = new DrizzleTripRepository()
  return {
    driver: new DriverTripService(repo, repo),
  }
}
