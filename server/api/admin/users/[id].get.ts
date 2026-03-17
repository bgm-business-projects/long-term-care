import { requireAdmin } from '../../../utils/requireAdmin'
import { useAdminUserServices } from '../../../utils/adminUserServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' })
  }

  const { query } = useAdminUserServices()
  return query.getUserDetail(id)
})
