import { requireAdmin } from '../../../utils/requireAdmin'
import { useConflictCheckServices } from '../../../utils/conflictCheckServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { vehicleId, scheduledAt, scheduledEndAt, excludeTripId } = body

  if (!vehicleId || !scheduledAt || !scheduledEndAt) {
    throw createError({ statusCode: 400, statusMessage: '缺少必要參數' })
  }

  const { check } = useConflictCheckServices()
  return check({
    vehicleId,
    scheduledAt: new Date(scheduledAt),
    scheduledEndAt: new Date(scheduledEndAt),
    excludeTripId,
  })
})
