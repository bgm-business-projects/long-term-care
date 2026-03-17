import { requireDeveloper } from '../../../../utils/requireDeveloper'
import { useAdminUserServices } from '../../../../utils/adminUserServices'
import { parseBody } from '../../../../shared/contracts/validation'
import { ChangeRoleSchema } from '../../../../shared/contracts/adminUser.dto'

export default defineEventHandler(async (event) => {
  const session = await requireDeveloper(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' })
  }

  const { role } = await parseBody(event, ChangeRoleSchema)
  const { command } = useAdminUserServices()
  return command.changeRole(id, role, session.user.id, (session.user as any).role)
})
