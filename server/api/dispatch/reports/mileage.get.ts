import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useReportServices } from '../../../utils/reportServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const query = getQuery(event)
  const { getMileageData } = useReportServices()
  return getMileageData({
    startDate: String(query.startDate || new Date().toISOString().split('T')[0]),
    endDate: String(query.endDate || new Date().toISOString().split('T')[0]),
    driverUserId: query.driverUserId as string | undefined,
    vehicleId: query.vehicleId as string | undefined,
  })
})
