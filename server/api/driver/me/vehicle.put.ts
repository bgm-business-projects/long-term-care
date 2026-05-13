import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireAuth'
import { useDb } from '../../../infrastructure/db/drizzle'
import { vehicles, driverProfiles } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  plate: z.string().min(1).max(20).optional(),
  vehicleType: z.string().min(1).max(50).optional(),
  seatCount: z.number().int().min(1).max(50).optional(),
  wheelchairCapacity: z.number().int().min(0).max(20).optional(),
  isAccessible: z.boolean().optional(),
  isRental: z.boolean().optional(),
  homeAddress: z.string().max(500).nullable().optional(),
  vehiclePhotoUrl: z.string().url().nullable().optional(),
  vehicleRegistrationUrl: z.string().url().nullable().optional(),
  compulsoryInsurer: z.string().max(100).nullable().optional(),
  insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  hasThirdPartyLiability: z.boolean().optional(),
  hasPassengerLiability: z.boolean().optional(),
  hasDriverInjury: z.boolean().optional(),
  hasExcessLiability: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const dto = await parseBody(event, Schema)
  const db = useDb()

  const profileRows = await db.select({ approvalStatus: driverProfiles.approvalStatus })
    .from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1)
  if (profileRows[0]?.approvalStatus === 'approved') {
    throw createError({ statusCode: 403, statusMessage: '已核准的資料無法自行修改，請聯絡平台管理員' })
  }

  const existing = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.driverUserId, user.id)).limit(1)
  if (!existing[0]) {
    throw createError({ statusCode: 404, statusMessage: '尚未建立車輛資料' })
  }

  // 車牌唯一檢查
  if (dto.plate) {
    const conflict = await db.select({ driverUserId: vehicles.driverUserId }).from(vehicles).where(eq(vehicles.plate, dto.plate)).limit(1)
    if (conflict[0] && conflict[0].driverUserId !== user.id) {
      throw createError({ statusCode: 409, statusMessage: `車牌 ${dto.plate} 已被其他司機登記` })
    }
  }

  const update: Record<string, unknown> = {}
  if (dto.plate !== undefined) update.plate = dto.plate
  if (dto.vehicleType !== undefined) update.vehicleType = dto.vehicleType
  if (dto.seatCount !== undefined) update.seatCount = dto.seatCount
  if (dto.wheelchairCapacity !== undefined) update.wheelchairCapacity = dto.wheelchairCapacity
  if (dto.isAccessible !== undefined) update.isAccessible = dto.isAccessible
  if (dto.isRental !== undefined) update.isRental = dto.isRental
  if (dto.homeAddress !== undefined) update.homeAddress = dto.homeAddress
  if (dto.vehiclePhotoUrl !== undefined) update.vehiclePhotoKey = dto.vehiclePhotoUrl
  if (dto.vehicleRegistrationUrl !== undefined) update.vehicleRegistrationKey = dto.vehicleRegistrationUrl
  if (dto.compulsoryInsurer !== undefined) update.compulsoryInsurer = dto.compulsoryInsurer
  if (dto.insuranceExpiry !== undefined) update.insuranceExpiry = dto.insuranceExpiry
  if (dto.hasThirdPartyLiability !== undefined) update.hasThirdPartyLiability = dto.hasThirdPartyLiability
  if (dto.hasPassengerLiability !== undefined) update.hasPassengerLiability = dto.hasPassengerLiability
  if (dto.hasDriverInjury !== undefined) update.hasDriverInjury = dto.hasDriverInjury
  if (dto.hasExcessLiability !== undefined) update.hasExcessLiability = dto.hasExcessLiability
  if (dto.notes !== undefined) update.notes = dto.notes

  if (Object.keys(update).length > 0) {
    await db.update(vehicles).set(update).where(eq(vehicles.driverUserId, user.id))
  }

  return { ok: true }
})
