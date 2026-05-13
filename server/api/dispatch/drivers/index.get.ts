import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { listDrivers } from '../../../utils/driverServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)

  const query = getQuery(event)

  // 預設只回傳 approved 司機（派車流程用）；admin 後台可傳 ?approvalStatus=all 取消過濾
  const rawApproval = query.approvalStatus as string | undefined
  let approvalStatus: 'pending' | 'approved' | 'rejected' | undefined = 'approved'
  if (rawApproval === 'all') {
    approvalStatus = undefined
  } else if (rawApproval === 'pending' || rawApproval === 'approved' || rawApproval === 'rejected') {
    approvalStatus = rawApproval
  }

  const filter = {
    search: (query.search as string) || undefined,
    status: (query.status as string) || undefined,
    approvalStatus,
    fleetId: (query.fleetId as string) || undefined,
  }

  return listDrivers(filter)
})
