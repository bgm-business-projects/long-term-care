import { z } from 'zod/v4'

const optionalUrl = z.string().url().nullable().optional()

export const DriverApplicationSchema = z.object({
  // 個人資料
  name: z.string().min(1).max(100),
  phone: z.string().min(8).max(20),
  termsAccepted: z.literal(true),

  // 車行
  hasFleet: z.boolean(),
  fleetId: z.string().nullable().optional(),

  // 證件 (S3 publicUrl)
  idCardFrontUrl: optionalUrl,
  idCardBackUrl: optionalUrl,
  professionalLicenseUrl: optionalUrl,
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),

  // 緊急聯絡人 (選填)
  emergencyContact: z.string().max(100).nullable().optional(),
  emergencyPhone: z.string().max(20).nullable().optional(),

  // 車輛
  vehicle: z.object({
    plate: z.string().min(1).max(20),
    vehicleType: z.string().min(1).max(50),
    seatCount: z.number().int().min(1).max(50),
    wheelchairCapacity: z.number().int().min(0).max(20),
    isAccessible: z.boolean(),
    isRental: z.boolean(),
    homeAddress: z.string().max(500).nullable().optional(),
    homeLat: z.number().min(-90).max(90).nullable().optional(),
    homeLng: z.number().min(-180).max(180).nullable().optional(),
    photoUrl: optionalUrl,
    registrationUrl: optionalUrl,
    // 強制險
    compulsoryInsurer: z.string().max(100).nullable().optional(),
    insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    // 其他險種
    hasThirdPartyLiability: z.boolean(),
    hasPassengerLiability: z.boolean(),
    hasDriverInjury: z.boolean(),
    hasExcessLiability: z.boolean(),
    notes: z.string().max(1000).nullable().optional(),
  }),
}).refine(
  (data) => !data.hasFleet || (data.hasFleet && data.fleetId),
  { message: 'fleetId is required when hasFleet is true', path: ['fleetId'] },
)

export type DriverApplicationDTO = z.infer<typeof DriverApplicationSchema>

export interface DriverApplicationStatusDTO {
  hasApplication: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
  submittedAt?: Date | null
  approvedAt?: Date | null
}
