import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireAuth'
import { useDb } from '../../../infrastructure/db/drizzle'
import { user as userTable, driverProfiles, fleets } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'

const Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(8).max(20).optional(),
  hasFleet: z.boolean().optional(),
  fleetId: z.string().nullable().optional(),
  emergencyContact: z.string().max(100).nullable().optional(),
  emergencyPhone: z.string().max(20).nullable().optional(),
  // 證件
  idCardFrontUrl: z.string().url().nullable().optional(),
  idCardBackUrl: z.string().url().nullable().optional(),
  professionalLicenseUrl: z.string().url().nullable().optional(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const dto = await parseBody(event, Schema)
  const db = useDb()

  const profileRows = await db.select({ id: driverProfiles.id, approvalStatus: driverProfiles.approvalStatus })
    .from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1)
  const profile = profileRows[0]
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: '尚未送出申請' })
  }
  if (profile.approvalStatus === 'approved') {
    throw createError({ statusCode: 403, statusMessage: '已核准的資料無法自行修改，請聯絡平台管理員' })
  }

  const fleetId = dto.hasFleet === false
    ? null
    : (dto.fleetId === undefined ? undefined : dto.fleetId)

  if (fleetId) {
    const f = await db.select({ id: fleets.id, isActive: fleets.isActive }).from(fleets).where(eq(fleets.id, fleetId)).limit(1)
    if (!f[0] || !f[0].isActive) {
      throw createError({ statusCode: 400, statusMessage: '所選車行不存在或已停用' })
    }
  }

  if (dto.name !== undefined) {
    await db.update(userTable).set({ name: dto.name }).where(eq(userTable.id, user.id))
  }

  const update: Record<string, unknown> = {}
  if (dto.phone !== undefined) update.phone = dto.phone
  if (fleetId !== undefined) update.fleetId = fleetId
  if (dto.emergencyContact !== undefined) update.emergencyContact = dto.emergencyContact
  if (dto.emergencyPhone !== undefined) update.emergencyPhone = dto.emergencyPhone
  if (dto.idCardFrontUrl !== undefined) update.idCardFrontKey = dto.idCardFrontUrl
  if (dto.idCardBackUrl !== undefined) update.idCardBackKey = dto.idCardBackUrl
  if (dto.professionalLicenseUrl !== undefined) update.professionalLicenseKey = dto.professionalLicenseUrl
  if (dto.licenseExpiry !== undefined) update.licenseExpiry = dto.licenseExpiry

  if (Object.keys(update).length > 0) {
    await db.update(driverProfiles).set(update).where(eq(driverProfiles.userId, user.id))
  }

  return { ok: true }
})
