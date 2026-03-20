import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { listTrips } from '../../../utils/tripDispatchServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const query = getQuery(event)
  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff can only see their own organization's trips
  const organizationId = (userRole === 'agency_staff')
    ? userOrgId
    : ((query.organizationId as string) || undefined)

  const filter = {
    date: (query.date as string) || undefined,
    status: (query.status as string) || undefined,
    organizationId: organizationId || undefined,
    vehicleId: (query.vehicleId as string) || undefined,
    driverUserId: (query.driverUserId as string) || undefined,
  }

  return listTrips(filter)
})
