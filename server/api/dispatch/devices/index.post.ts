import { z } from 'zod/v4'
import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const dto = await parseBody(event, Schema)
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  // admin/developer 建立的是平台共用；機構人員建立的歸屬自己機構
  const organizationId = (role === 'admin' || role === 'developer') ? null : (orgId ?? null)
  if (role !== 'admin' && role !== 'developer' && !organizationId) {
    throw createError({ statusCode: 400, statusMessage: '機構人員需歸屬機構才能新增輔具' })
  }

  const { create } = useDeviceServices()
  setResponseStatus(event, 201)
  return create({ name: dto.name, description: dto.description ?? null, organizationId })
})
