import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getTripById, cancelTrip } from '../../../utils/tripDispatchServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Trip ID required' })
  }

  const existing = await getTripById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' })
  }

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId as string | null

  // agency_staff 只能取消自己機構的訂單
  if (userRole === 'agency_staff' && existing.organizationId !== userOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await cancelTrip(id)

  return { success: true }
})
