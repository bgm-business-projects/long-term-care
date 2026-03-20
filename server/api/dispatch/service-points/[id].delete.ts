import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useServicePointServices } from '../../../utils/servicePointServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id') as string

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  const { getById, delete: deleteServicePoint } = useServicePointServices()
  const existing = await getById(id)

  // agency_staff 只能刪除自己機構或個案的據點
  if (userRole === 'agency_staff') {
    const isOrgPoint = existing.organizationId === userOrgId
    const isCareRecipientPoint = !!existing.careRecipientId
    if (!isOrgPoint && !isCareRecipientPoint) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  return deleteServicePoint(id)
})
