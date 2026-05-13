import { eq } from 'drizzle-orm'
import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useDeviceServices } from '../../../utils/assistiveDeviceServices'
import { useDb } from '../../../infrastructure/db/drizzle'
import { assistiveDevices } from '../../../infrastructure/db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Device ID required' })
  const role = (session.user as { role?: string }).role
  const orgId = (session.user as { organizationId?: string }).organizationId

  if (role !== 'admin' && role !== 'developer') {
    const db = useDb()
    const target = await db.select({ organizationId: assistiveDevices.organizationId }).from(assistiveDevices).where(eq(assistiveDevices.id, id)).limit(1)
    if (!target[0] || target[0].organizationId !== orgId) {
      throw createError({ statusCode: 403, statusMessage: '無權刪除此輔具' })
    }
  }

  const { softDelete } = useDeviceServices()
  await softDelete(id)
  return { ok: true }
})
