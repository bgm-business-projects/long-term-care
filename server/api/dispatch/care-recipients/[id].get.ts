import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getCareRecipientById } from '../../../utils/careRecipientServices'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'
import { useSpecialNeedServices } from '../../../utils/specialNeedServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Care recipient ID required' })
  }

  const recipient = await getCareRecipientById(id)
  if (!recipient) {
    throw createError({ statusCode: 404, statusMessage: 'Care recipient not found' })
  }

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId

  if (userRole === 'agency_staff' && recipient.organizationId !== userOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const { listForRecipient } = useDeviceServices()
  const devices = await listForRecipient(id)
  const { listForRecipient: listSpecialNeedsForRecipient } = useSpecialNeedServices()
  const specialNeedsList = await listSpecialNeedsForRecipient(id)
  return { ...recipient, devices, specialNeeds: specialNeedsList }
})
