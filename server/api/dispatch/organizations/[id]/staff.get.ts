import { requireAdmin } from '../../../../utils/requireAdmin'
import { listOrgStaff } from '../../../../utils/orgStaffServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const orgId = getRouterParam(event, 'id')!
  return listOrgStaff(orgId)
})
