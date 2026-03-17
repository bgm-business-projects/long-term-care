import { requireAdmin } from '../../../utils/requireAdmin'
import { useAdminUserServices } from '../../../utils/adminUserServices'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' })
  }

  const { command } = useAdminUserServices()
  return command.deleteUser(id, session.user.id)
})
