import { z } from 'zod/v4'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useCarpoolSettings } from '../../../utils/carpoolSettingsServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  maxDestinationDistanceMeters: z.number().int().min(50).max(10000).optional(),
  maxDepartureWindowMinutes: z.number().int().min(5).max(240).optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event)
  const dto = await parseBody(event, Schema)
  const { set, get } = useCarpoolSettings()
  await set(dto, user.id)
  return get()
})
