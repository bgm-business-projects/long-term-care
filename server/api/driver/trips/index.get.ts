import { requireDriver } from '../../../utils/requireDriver'
import { useTripServices } from '../../../utils/tripServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const { date } = getQuery(event)

  const targetDate = date ? new Date(date as string) : new Date()
  if (isNaN(targetDate.getTime())) {
    console.warn('[driver/trips] Invalid date param:', date)
    throw createError({ statusCode: 400, statusMessage: 'Invalid date format' })
  }

  console.log(`[driver/trips] user=${user.id} fetching trips for date=${targetDate.toISOString().split('T')[0]}`)

  const { driver } = useTripServices()
  const trips = await driver.getTripsForDate(user.id, targetDate)

  console.log(`[driver/trips] returned ${trips.length} trips`)
  return trips
})
