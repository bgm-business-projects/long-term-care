import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useSpecialNeedServices } from '../../../utils/specialNeedServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  const { listForOrganization, listAll } = useSpecialNeedServices()
  if (role === 'admin' || role === 'developer') {
    return listAll()
  }
  return listForOrganization(orgId ?? null)
})
