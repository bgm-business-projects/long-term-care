import { z } from 'zod/v4'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useFleetServices } from '../../../utils/fleetServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  contactPerson: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  taxId: z.string().max(20).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Fleet ID required' })
  }
  const dto = await parseBody(event, Schema)
  const { update } = useFleetServices()
  return update(id, dto)
})
