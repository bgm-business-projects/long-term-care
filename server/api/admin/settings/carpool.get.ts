import { requireAdmin } from '../../../utils/requireAdmin'
import { useCarpoolSettings } from '../../../utils/carpoolSettingsServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { get } = useCarpoolSettings()
  return get()
})
