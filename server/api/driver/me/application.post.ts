import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireAuth'
import { useDb } from '../../../infrastructure/db/drizzle'
import { user as userTable, driverProfiles, vehicles, fleets } from '../../../infrastructure/db/schema'
import { parseBody } from '../../../shared/contracts/validation'
import { DriverApplicationSchema } from '../../../shared/contracts/driverApplication.dto'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const dto = await parseBody(event, DriverApplicationSchema)

  const db = useDb()

  // 檢查既有 profile
  const existingProfile = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1)
  if (existingProfile.length > 0 && existingProfile[0]!.approvalStatus !== 'rejected') {
    throw createError({ statusCode: 409, statusMessage: '已有申請紀錄，請至「申請狀態」頁查看' })
  }

  // 檢查車牌唯一
  const plateConflict = await db.select({ id: vehicles.id, driverUserId: vehicles.driverUserId })
    .from(vehicles)
    .where(eq(vehicles.plate, dto.vehicle.plate))
    .limit(1)
  if (plateConflict[0] && plateConflict[0].driverUserId !== user.id) {
    throw createError({ statusCode: 409, statusMessage: `車牌 ${dto.vehicle.plate} 已被其他司機登記` })
  }

  // 檢查車行存在
  if (dto.hasFleet && dto.fleetId) {
    const fleetRow = await db.select({ id: fleets.id, isActive: fleets.isActive })
      .from(fleets)
      .where(eq(fleets.id, dto.fleetId))
      .limit(1)
    if (!fleetRow[0] || !fleetRow[0].isActive) {
      throw createError({ statusCode: 400, statusMessage: '所選車行不存在或已停用' })
    }
  }

  const now = new Date()
  const fleetId = dto.hasFleet ? dto.fleetId ?? null : null

  // 1. 更新 user：name + role=driver + consent + onboarding
  await db.update(userTable).set({
    name: dto.name,
    role: 'driver',
    consentAcceptedAt: user.consentAcceptedAt ? undefined : now,
    onboardingCompletedAt: now,
  }).where(eq(userTable.id, user.id))

  // 2. 建立或更新 driver_profile (rejected 重新申請會 reset)
  if (existingProfile.length === 0) {
    await db.insert(driverProfiles).values({
      id: crypto.randomUUID(),
      userId: user.id,
      fleetId,
      phone: dto.phone,
      termsAcceptedAt: now,
      idCardFrontKey: dto.idCardFrontUrl ?? null,
      idCardBackKey: dto.idCardBackUrl ?? null,
      professionalLicenseKey: dto.professionalLicenseUrl ?? null,
      licenseExpiry: dto.licenseExpiry ?? null,
      approvalStatus: 'pending',
      approvedAt: null,
      approvedById: null,
      rejectionReason: null,
      emergencyContact: dto.emergencyContact ?? null,
      emergencyPhone: dto.emergencyPhone ?? null,
    })
  } else {
    await db.update(driverProfiles).set({
      fleetId,
      phone: dto.phone,
      termsAcceptedAt: now,
      idCardFrontKey: dto.idCardFrontUrl ?? null,
      idCardBackKey: dto.idCardBackUrl ?? null,
      professionalLicenseKey: dto.professionalLicenseUrl ?? null,
      licenseExpiry: dto.licenseExpiry ?? null,
      approvalStatus: 'pending',
      approvedAt: null,
      approvedById: null,
      rejectionReason: null,
      emergencyContact: dto.emergencyContact ?? null,
      emergencyPhone: dto.emergencyPhone ?? null,
    }).where(eq(driverProfiles.userId, user.id))
  }

  // 3. 建立或更新 vehicle (1:1)
  const v = dto.vehicle
  const vehicleValues = {
    plate: v.plate,
    vehicleType: v.vehicleType,
    seatCount: v.seatCount,
    wheelchairCapacity: v.wheelchairCapacity,
    isAccessible: v.isAccessible,
    isRental: v.isRental,
    homeAddress: v.homeAddress ?? null,
    homeLat: v.homeLat == null ? null : String(v.homeLat),
    homeLng: v.homeLng == null ? null : String(v.homeLng),
    vehiclePhotoKey: v.photoUrl ?? null,
    vehicleRegistrationKey: v.registrationUrl ?? null,
    compulsoryInsurer: v.compulsoryInsurer ?? null,
    insuranceExpiry: v.insuranceExpiry ?? null,
    hasThirdPartyLiability: v.hasThirdPartyLiability,
    hasPassengerLiability: v.hasPassengerLiability,
    hasDriverInjury: v.hasDriverInjury,
    hasExcessLiability: v.hasExcessLiability,
    notes: v.notes ?? null,
  }

  const existingVehicle = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.driverUserId, user.id)).limit(1)
  if (existingVehicle.length === 0) {
    await db.insert(vehicles).values({
      id: crypto.randomUUID(),
      driverUserId: user.id,
      ...vehicleValues,
    })
  } else {
    await db.update(vehicles).set(vehicleValues).where(eq(vehicles.driverUserId, user.id))
  }

  setResponseStatus(event, 201)
  return { ok: true, approvalStatus: 'pending' as const }
})
