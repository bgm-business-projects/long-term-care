import { z } from 'zod'
import { requireDriver } from '../../../../utils/requireDriver'
import { useTripServices } from '../../../../utils/tripServices'

const StatusSchema = z.object({
  logStatus: z.enum(['departed', 'arrived_origin', 'recipient_boarded', 'completed']),
  lat: z.string().optional(),
  lng: z.string().optional(),
  mileageActual: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireDriver(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  console.log(`[driver/trips/:id/status] user=${user.id} trip=${id} body=`, body)

  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) {
    console.warn(`[driver/trips/:id/status] validation failed:`, parsed.error.issues)
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  const { driver } = useTripServices()
  await driver.updateStatus(id, user.id, parsed.data)

  console.log(`[driver/trips/:id/status] updated trip=${id} logStatus=${parsed.data.logStatus}`)
  return { ok: true }
})
