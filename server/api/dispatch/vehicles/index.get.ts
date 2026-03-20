import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useVehicleServices } from '../../../utils/vehicleServices'

export default defineEventHandler(async (event) => {
  const t0 = Date.now()

  await requireAgencyStaff(event)
  const t1 = Date.now()
  console.log(`[vehicles] requireAgencyStaff: ${t1 - t0}ms`)

  const query = getQuery(event)
  const { list } = useVehicleServices()
  const result = await list({
    search: query.search as string | undefined,
    activeOnly: query.activeOnly !== 'false',
  })
  const t2 = Date.now()
  console.log(`[vehicles] db list: ${t2 - t1}ms`)
  console.log(`[vehicles] total: ${t2 - t0}ms`)

  return result
})
