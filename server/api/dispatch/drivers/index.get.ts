import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { listDrivers } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const query = getQuery(event)

  const filter = {
    search: (query.search as string) || undefined,
    status: (query.status as string) || undefined,
  }

  return listDrivers(filter)
})
