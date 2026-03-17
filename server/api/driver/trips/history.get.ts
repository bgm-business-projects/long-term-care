import { requireDriver } from '../../../utils/requireDriver'
import { useTripServices } from '../../../utils/tripServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const { page } = getQuery(event)

  const pageNum = Math.max(1, parseInt((page as string) || '1', 10))

  console.log(`[driver/trips/history] user=${user.id} page=${pageNum}`)

  const { driver } = useTripServices()
  const trips = await driver.getTripHistory(user.id, pageNum)

  console.log(`[driver/trips/history] returned ${trips.length} trips`)
  return trips
})
