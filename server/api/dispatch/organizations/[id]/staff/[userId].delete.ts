import { requireAdmin } from '../../../../../utils/requireAdmin'
import { removeOrgStaff } from '../../../../../utils/orgStaffServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const userId = getRouterParam(event, 'userId')!
  await removeOrgStaff(userId)
  return { ok: true }
})
