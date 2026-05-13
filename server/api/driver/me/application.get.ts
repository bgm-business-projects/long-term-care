import { requireAuth } from '../../../utils/requireAuth'
import { getDriverWithVehicle } from '../../../utils/driverServices'
import type { DriverApplicationStatusDTO } from '../../../shared/contracts/driverApplication.dto'

export default defineEventHandler(async (event): Promise<DriverApplicationStatusDTO & { driver?: unknown; vehicle?: unknown }> => {
  const { user } = await requireAuth(event)

  const result = await getDriverWithVehicle(user.id)
  if (!result) {
    return {
      hasApplication: false,
      approvalStatus: null,
    }
  }

  return {
    hasApplication: true,
    approvalStatus: result.driver.approvalStatus as 'pending' | 'approved' | 'rejected',
    rejectionReason: result.driver.rejectionReason as string | null,
    submittedAt: result.driver.createdAt as Date,
    approvedAt: result.driver.approvedAt as Date | null,
    driver: result.driver,
    vehicle: result.vehicle,
  }
})
