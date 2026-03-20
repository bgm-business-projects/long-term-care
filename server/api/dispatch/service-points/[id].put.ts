import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useServicePointServices } from '../../../utils/servicePointServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  // agency_staff 只能編輯自己機構或個案的據點
  if (userRole === 'agency_staff') {
    const { getById } = useServicePointServices()
    const existing = await getById(id)
    const isOrgPoint = existing.organizationId === userOrgId && !existing.careRecipientId
    const isCareRecipientPoint = !!existing.careRecipientId // TODO: verify care recipient belongs to their org
    if (!isOrgPoint && !isCareRecipientPoint) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const { update } = useServicePointServices()
  return update(id, {
    name: body.name,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    category: body.category,
  })
})
