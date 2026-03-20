import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getTripById } from '../../../utils/tripDispatchServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Trip ID required' })
  }

  const trip = await getTripById(id)
  if (!trip) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  }

  // agency_staff can only access their own organization's trips
  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  if (userRole === 'agency_staff' && trip.organizationId !== userOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return trip
})
