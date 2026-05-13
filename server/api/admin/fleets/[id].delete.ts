import { requireAdmin } from '../../../utils/requireAdmin'
import { useFleetServices } from '../../../utils/fleetServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Fleet ID required' })
  }
  const { softDelete } = useFleetServices()
  await softDelete(id)
  return { ok: true }
})
