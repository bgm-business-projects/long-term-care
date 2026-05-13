import { requireAdmin } from '../../../utils/requireAdmin'
import { dissolveCarpool } from '../../../utils/carpoolServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Group ID required' })
  await dissolveCarpool(id)
  return { ok: true }
})
