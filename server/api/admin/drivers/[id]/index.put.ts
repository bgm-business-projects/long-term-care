import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { user as userTable, driverProfiles, fleets } from '../../../../infrastructure/db/schema'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  // user
  name: z.string().min(1).max(100).optional(),
  // driver_profile
  phone: z.string().max(20).optional(),
  fleetId: z.string().nullable().optional(),
  emergencyContact: z.string().max(100).nullable().optional(),
  emergencyPhone: z.string().max(20).nullable().optional(),
  // 證件
  idCardFrontKey: z.string().nullable().optional(),
  idCardBackKey: z.string().nullable().optional(),
  professionalLicenseKey: z.string().nullable().optional(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // 狀態
  isActive: z.boolean().optional(),
  status: z.enum(['active', 'on_leave', 'resigned']).optional(),
  unavailableDates: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Driver ID required' })
  }
  const dto = await parseBody(event, Schema)
  const db = useDb()

  const profileRows = await db.select({ userId: driverProfiles.userId }).from(driverProfiles).where(eq(driverProfiles.id, id)).limit(1)
  const profile = profileRows[0]
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }

  // 校驗車行存在
  if (dto.fleetId) {
    const f = await db.select({ id: fleets.id }).from(fleets).where(eq(fleets.id, dto.fleetId)).limit(1)
    if (!f[0]) {
      throw createError({ statusCode: 400, statusMessage: '所選車行不存在' })
    }
  }

  if (dto.name !== undefined) {
    await db.update(userTable).set({ name: dto.name }).where(eq(userTable.id, profile.userId))
  }

  const profileUpdate: Record<string, unknown> = {}
  if (dto.phone !== undefined) profileUpdate.phone = dto.phone
  if (dto.fleetId !== undefined) profileUpdate.fleetId = dto.fleetId
  if (dto.emergencyContact !== undefined) profileUpdate.emergencyContact = dto.emergencyContact
  if (dto.emergencyPhone !== undefined) profileUpdate.emergencyPhone = dto.emergencyPhone
  if (dto.idCardFrontKey !== undefined) profileUpdate.idCardFrontKey = dto.idCardFrontKey
  if (dto.idCardBackKey !== undefined) profileUpdate.idCardBackKey = dto.idCardBackKey
  if (dto.professionalLicenseKey !== undefined) profileUpdate.professionalLicenseKey = dto.professionalLicenseKey
  if (dto.licenseExpiry !== undefined) profileUpdate.licenseExpiry = dto.licenseExpiry
  if (dto.isActive !== undefined) profileUpdate.isActive = dto.isActive
  if (dto.status !== undefined) profileUpdate.status = dto.status
  if (dto.unavailableDates !== undefined) profileUpdate.unavailableDates = dto.unavailableDates

  if (Object.keys(profileUpdate).length > 0) {
    await db.update(driverProfiles).set(profileUpdate).where(eq(driverProfiles.id, id))
  }

  return { ok: true }
})
