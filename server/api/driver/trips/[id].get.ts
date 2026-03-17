import { requireDriver } from '../../../utils/requireDriver'
import { useTripServices } from '../../../utils/tripServices'

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const id = getRouterParam(event, 'id')!

  console.log(`[driver/trips/:id] user=${user.id} fetching trip=${id}`)

  const { driver } = useTripServices()
  const trip = await driver.getTripDetail(id, user.id)

  console.log(`[driver/trips/:id] found trip=${id} status=${trip.status}`)
  return trip
})
