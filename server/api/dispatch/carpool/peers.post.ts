import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { vehicles } from '../../../infrastructure/db/schema'
import { findCarpoolPeers } from '../../../utils/carpoolServices'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  anchorTripId: z.string().min(1),
  /** 用此司機的車輛座位數作為共乘群人數上限（選填） */
  driverUserId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const dto = await parseBody(event, Schema)

  let seatCount: number | null = null
  if (dto.driverUserId) {
    const db = useDb()
    const v = await db.select({ seatCount: vehicles.seatCount })
      .from(vehicles)
      .where(eq(vehicles.driverUserId, dto.driverUserId))
      .limit(1)
    seatCount = v[0]?.seatCount ?? null
  }

  const passengers = await findCarpoolPeers(dto.anchorTripId, seatCount)
  return { passengers, seatCount }
})
