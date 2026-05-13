import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { assistiveDevices } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Device ID required' })
  const dto = await parseBody(event, Schema)
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  // 機構人員只能改自己機構的輔具
  if (role !== 'admin' && role !== 'developer') {
    const db = useDb()
    const target = await db.select({ organizationId: assistiveDevices.organizationId }).from(assistiveDevices).where(eq(assistiveDevices.id, id)).limit(1)
    if (!target[0] || target[0].organizationId !== orgId) {
      throw createError({ statusCode: 403, statusMessage: '無權修改此輔具' })
    }
  }

  const { update } = useDeviceServices()
  return update(id, dto)
})
