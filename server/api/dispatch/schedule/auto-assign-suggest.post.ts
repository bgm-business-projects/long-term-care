import { z } from 'zod/v4'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useAutoAssignServices } from '../../../utils/autoAssignServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  tripId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const dto = await parseBody(event, Schema)
  const { suggestForTrip } = useAutoAssignServices()
  return suggestForTrip(dto.tripId)
})
