import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  const { listForOrganization, listAll } = useDeviceServices()
  // admin/developer 看全部；agency_staff 看「平台共用 OR 自己機構」
  if (role === 'admin' || role === 'developer') {
    return listAll()
  }
  return listForOrganization(orgId ?? null)
})
