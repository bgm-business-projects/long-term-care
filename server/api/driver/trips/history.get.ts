import { requireDriver } from '../../../utils/requireDriver'
import { useTripServices } from '../../../utils/tripServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const { page, startDate, endDate } = getQuery(event)

  const pageNum = Math.max(1, parseInt((page as string) || '1', 10))

  let dateRange: { startDate: Date; endDate: Date } | undefined
  if (startDate && endDate) {
    const s = new Date(`${startDate}T00:00:00+08:00`)
    const e = new Date(`${endDate}T23:59:59+08:00`)
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      dateRange = { startDate: s, endDate: e }
    }
  }

  console.log(`[driver/trips/history] user=${user.id} page=${pageNum} range=${dateRange ? `${startDate}~${endDate}` : 'none'}`)

  const { driver } = useTripServices()
  const trips = await driver.getTripHistory(user.id, pageNum, dateRange)

  console.log(`[driver/trips/history] returned ${trips.length} trips`)
  return trips
})
