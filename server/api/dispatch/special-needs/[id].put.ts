import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useSpecialNeedServices } from '../../../utils/specialNeedServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { specialNeeds } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' })
  const dto = await parseBody(event, Schema)
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  if (role !== 'admin' && role !== 'developer') {
    const db = useDb()
    const target = await db.select({ organizationId: specialNeeds.organizationId }).from(specialNeeds).where(eq(specialNeeds.id, id)).limit(1)
    if (!target[0] || target[0].organizationId !== orgId) {
      throw createError({ statusCode: 403, statusMessage: '無權修改此特殊需求' })
    }
  }

  const { update } = useSpecialNeedServices()
  return update(id, dto)
})
