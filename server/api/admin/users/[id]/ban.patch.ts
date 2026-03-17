import { requireAdmin } from '../../../../utils/requireAdmin'
import { useAdminUserServices } from '../../../../utils/adminUserServices'
import { parseBody } from '../../../../shared/contracts/validation'
import { BanUserSchema } from '../../../../shared/contracts/adminUser.dto'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' })
  }

  const { banned } = await parseBody(event, BanUserSchema)
  const { command } = useAdminUserServices()
  return command.toggleBan(id, banned, session.user.id)
})
