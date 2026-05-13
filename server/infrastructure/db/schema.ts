import { pgTable, pgEnum, text, integer, boolean, timestamp, numeric, date, primaryKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Better Auth tables ───────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  banned: boolean('banned').notNull().default(false),
  subscriptionTier: text('subscription_tier').notNull().default('free'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true, mode: 'date' }),
  lastNotifiedTier: text('last_notified_tier').notNull().default('free'),
  consentAcceptedAt: timestamp('consent_accepted_at', { withTimezone: true, mode: 'date' }),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true, mode: 'date' }),
  convertedFromGuestAt: timestamp('converted_from_guest_at', { withTimezone: true, mode: 'date' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' })
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true, mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true, mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
})

// ─── Redemption Code ─────────────────────────────────────

export const redemptionCode = pgTable('redemption_code', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  tier: text('tier').notNull(),
  durationDays: integer('duration_days'),
  disabled: boolean('disabled').notNull().default(false),
  batchId: text('batch_id'),
  usedById: text('used_by_id').references(() => user.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
})

// ─── Dispatch System Enums ────────────────────────────────

// 已停用：原本的 special_needs enum 已被 special_needs 表 + junction 取代
// export const specialNeedsEnum = pgEnum('special_needs', ['general', 'wheelchair', 'bedridden'])
export const tripStatusEnum = pgEnum('trip_status', ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
export const tripLogStatusEnum = pgEnum('trip_log_status', ['departed', 'arrived_origin', 'recipient_boarded', 'completed'])
export const servicePointCategoryEnum = pgEnum('service_point_category', ['hospital', 'rehab', 'other'])
export const driverStatusEnum = pgEnum('driver_status', ['active', 'on_leave', 'resigned'])
export const driverApprovalStatusEnum = pgEnum('driver_approval_status', ['pending', 'approved', 'rejected'])

// ─── Fleets (車行) ────────────────────────────────────────

export const specialNeeds = pgTable('special_needs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  // null = 平台共用；填值 = 機構自訂
  organizationId: text('organization_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const careRecipientSpecialNeeds = pgTable('care_recipient_special_needs', {
  careRecipientId: text('care_recipient_id').notNull(),
  specialNeedId: text('special_need_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.careRecipientId, t.specialNeedId] }),
}))

export const assistiveDevices = pgTable('assistive_devices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  // null = 平台共用；填值 = 機構自訂（僅該機構可見/可選）
  organizationId: text('organization_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const careRecipientDevices = pgTable('care_recipient_devices', {
  careRecipientId: text('care_recipient_id').notNull(),
  deviceId: text('device_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.careRecipientId, t.deviceId] }),
}))

export const tripDevices = pgTable('trip_devices', {
  tripId: text('trip_id').notNull(),
  deviceId: text('device_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.tripId, t.deviceId] }),
}))

export const fleets = pgTable('fleets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

// ─── Dispatch System Tables ───────────────────────────────

export const driverProfiles = pgTable('driver_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  fleetId: text('fleet_id').references(() => fleets.id, { onDelete: 'set null' }),
  phone: text('phone').notNull(),
  // 同意條款
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true, mode: 'date' }),
  // 證件 (S3 keys)
  idCardFrontKey: text('id_card_front_key'),
  idCardBackKey: text('id_card_back_key'),
  professionalLicenseKey: text('professional_license_key'),
  licenseExpiry: date('license_expiry', { mode: 'string' }),
  // 審核
  approvalStatus: driverApprovalStatusEnum('approval_status').notNull().default('pending'),
  approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
  approvedById: text('approved_by_id').references(() => user.id, { onDelete: 'set null' }),
  rejectionReason: text('rejection_reason'),
  // 營運狀態
  status: driverStatusEnum('status').notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  unavailableDates: text('unavailable_dates'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverUserId: text('driver_user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  // 車輛基本資料
  plate: text('plate').notNull().unique(),
  vehicleType: text('vehicle_type').notNull(),
  seatCount: integer('seat_count').notNull().default(4),
  wheelchairCapacity: integer('wheelchair_capacity').notNull().default(0),
  isAccessible: boolean('is_accessible').notNull().default(false),
  isRental: boolean('is_rental').notNull().default(false),
  // 起始地點
  homeAddress: text('home_address'),
  homeLat: numeric('home_lat', { precision: 10, scale: 7 }),
  homeLng: numeric('home_lng', { precision: 10, scale: 7 }),
  // 文件 (S3 keys)
  vehiclePhotoKey: text('vehicle_photo_key'),
  vehicleRegistrationKey: text('vehicle_registration_key'),
  // 強制險
  compulsoryInsurer: text('compulsory_insurer'),
  insuranceExpiry: date('insurance_expiry', { mode: 'string' }),
  // 其他險種
  hasThirdPartyLiability: boolean('has_third_party_liability').notNull().default(false),
  hasPassengerLiability: boolean('has_passenger_liability').notNull().default(false),
  hasDriverInjury: boolean('has_driver_injury').notNull().default(false),
  hasExcessLiability: boolean('has_excess_liability').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
})

export const careRecipients = pgTable('care_recipients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const servicePoints = pgTable('service_points', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // null = 全域（admin 管理），organizationId set = 機構專屬，careRecipientId set = 個案專屬
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  careRecipientId: text('care_recipient_id').references(() => careRecipients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  category: servicePointCategoryEnum('category').notNull().default('other'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
})

export const trips = pgTable('trips', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id').notNull().references(() => careRecipients.id, { onDelete: 'restrict' }),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  driverUserId: text('driver_user_id').references(() => user.id, { onDelete: 'set null' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
  scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true, mode: 'date' }),
  estimatedDuration: integer('estimated_duration'),
  originAddress: text('origin_address').notNull(),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
  destinationAddress: text('destination_address').notNull(),
  destinationLat: numeric('destination_lat', { precision: 10, scale: 7 }),
  destinationLng: numeric('destination_lng', { precision: 10, scale: 7 }),
  status: tripStatusEnum('status').notNull().default('pending'),
  mileageEstimated: numeric('mileage_estimated', { precision: 8, scale: 2 }),
  mileageActual: numeric('mileage_actual', { precision: 8, scale: 2 }),
  needsWheelchair: boolean('needs_wheelchair').notNull().default(false),
  notes: text('notes'),
  recurringScheduleId: text('recurring_schedule_id'),
  // 共乘：若屬於某個 carpool_group，所有同群 trips 共用司機/車輛/最終目的地與路線順序
  carpoolGroupId: text('carpool_group_id'),
  carpoolOrder: integer('carpool_order'),
  // 該乘客實際排定上車時間（可能晚於原 scheduledAt 因要等司機從前一位過來）
  carpoolPickupAt: timestamp('carpool_pickup_at', { withTimezone: true, mode: 'date' }),
  // 共乘下車順序（多目的地用：與上車順序可不同）
  carpoolDropoffOrder: integer('carpool_dropoff_order'),
  carpoolDropoffAt: timestamp('carpool_dropoff_at', { withTimezone: true, mode: 'date' }),
  // 來回配對：outbound/return 互相 link；null = 一般單程
  pairedTripId: text('paired_trip_id'),
  tripDirection: text('trip_direction'), // 'outbound' | 'return' | null
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const tripStatusLogs = pgTable('trip_status_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  driverUserId: text('driver_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  status: tripLogStatusEnum('status').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  note: text('note'),
})

export const recurringSchedules = pgTable('recurring_schedules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id').notNull().references(() => careRecipients.id, { onDelete: 'restrict' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  daysOfWeek: text('days_of_week').notNull(), // JSON array string: "[1,3,5]"
  departureTime: text('departure_time').notNull(), // "HH:mm"
  originAddress: text('origin_address').notNull(),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
  destinationAddress: text('destination_address').notNull(),
  destinationLat: numeric('destination_lat', { precision: 10, scale: 7 }),
  destinationLng: numeric('destination_lng', { precision: 10, scale: 7 }),
  needsWheelchair: boolean('needs_wheelchair').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  effectiveStartDate: date('effective_start_date', { mode: 'string' }),
  effectiveEndDate: date('effective_end_date', { mode: 'string' }),
  estimatedDuration: integer('estimated_duration'),
  // 來回設定：若 roundTrip=true，每次展開會建立 outbound + return 兩筆 trips
  roundTrip: boolean('round_trip').notNull().default(false),
  returnDepartureTime: text('return_departure_time'), // "HH:mm" 回程從目的地出發時間
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const incidentTypeEnum = pgEnum('incident_type', ['sick', 'missing', 'no_show', 'accident', 'other'])
export const carpoolStatusEnum = pgEnum('carpool_status', ['planned', 'in_progress', 'completed', 'cancelled'])

// 共乘群組（多筆 trips 共用一位司機/車輛/最終目的地與排序路線）
export const carpoolGroups = pgTable('carpool_groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverUserId: text('driver_user_id').references(() => user.id, { onDelete: 'set null' }),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  // 共同最終目的地（每筆 trip 仍保留自己的 destinationAddress；以群組的為準）
  destinationAddress: text('destination_address').notNull(),
  destinationLat: numeric('destination_lat', { precision: 10, scale: 7 }),
  destinationLng: numeric('destination_lng', { precision: 10, scale: 7 }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
  scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true, mode: 'date' }),
  status: carpoolStatusEnum('status').notNull().default('planned'),
  totalDistanceMeters: integer('total_distance_meters'),
  totalDurationMinutes: integer('total_duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const tripIncidents = pgTable('trip_incidents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  driverUserId: text('driver_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  type: incidentTypeEnum('type').notNull(),
  description: text('description'),
  reportedAt: timestamp('reported_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  resolvedById: text('resolved_by_id').references(() => user.id, { onDelete: 'set null' }),
  resolutionNote: text('resolution_note'),
})

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  authorUserId: text('author_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
})

// ─── Relations ────────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  redemptionCodes: many(redemptionCode),
  organization: one(organizations, { fields: [user.organizationId], references: [organizations.id] }),
  driverProfile: one(driverProfiles, { fields: [user.id], references: [driverProfiles.userId] }),
  driverTrips: many(trips),
  tripStatusLogs: many(tripStatusLogs),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] })
}))

export const redemptionCodeRelations = relations(redemptionCode, ({ one }) => ({
  usedBy: one(user, { fields: [redemptionCode.usedById], references: [user.id] })
}))

export const driverProfileRelations = relations(driverProfiles, ({ one }) => ({
  user: one(user, { fields: [driverProfiles.userId], references: [user.id], relationName: 'driver_user' }),
  fleet: one(fleets, { fields: [driverProfiles.fleetId], references: [fleets.id] }),
  approvedBy: one(user, { fields: [driverProfiles.approvedById], references: [user.id], relationName: 'driver_approver' }),
  vehicle: one(vehicles, { fields: [driverProfiles.userId], references: [vehicles.driverUserId] }),
}))

export const fleetRelations = relations(fleets, ({ many }) => ({
  drivers: many(driverProfiles),
}))

export const assistiveDeviceRelations = relations(assistiveDevices, ({ one, many }) => ({
  organization: one(organizations, { fields: [assistiveDevices.organizationId], references: [organizations.id] }),
  careRecipientDevices: many(careRecipientDevices),
  tripDevices: many(tripDevices),
}))

export const careRecipientDeviceRelations = relations(careRecipientDevices, ({ one }) => ({
  careRecipient: one(careRecipients, { fields: [careRecipientDevices.careRecipientId], references: [careRecipients.id] }),
  device: one(assistiveDevices, { fields: [careRecipientDevices.deviceId], references: [assistiveDevices.id] }),
}))

export const tripDeviceRelations = relations(tripDevices, ({ one }) => ({
  trip: one(trips, { fields: [tripDevices.tripId], references: [trips.id] }),
  device: one(assistiveDevices, { fields: [tripDevices.deviceId], references: [assistiveDevices.id] }),
}))

export const specialNeedRelations = relations(specialNeeds, ({ one, many }) => ({
  organization: one(organizations, { fields: [specialNeeds.organizationId], references: [organizations.id] }),
  recipientLinks: many(careRecipientSpecialNeeds),
}))

export const careRecipientSpecialNeedRelations = relations(careRecipientSpecialNeeds, ({ one }) => ({
  careRecipient: one(careRecipients, { fields: [careRecipientSpecialNeeds.careRecipientId], references: [careRecipients.id] }),
  specialNeed: one(specialNeeds, { fields: [careRecipientSpecialNeeds.specialNeedId], references: [specialNeeds.id] }),
}))

export const organizationRelations = relations(organizations, ({ many }) => ({
  careRecipients: many(careRecipients),
  trips: many(trips),
  recurringSchedules: many(recurringSchedules),
  users: many(user),
}))

export const careRecipientRelations = relations(careRecipients, ({ one, many }) => ({
  organization: one(organizations, { fields: [careRecipients.organizationId], references: [organizations.id] }),
  trips: many(trips),
  recurringSchedules: many(recurringSchedules),
}))

export const tripRelations = relations(trips, ({ one, many }) => ({
  careRecipient: one(careRecipients, { fields: [trips.careRecipientId], references: [careRecipients.id] }),
  vehicle: one(vehicles, { fields: [trips.vehicleId], references: [vehicles.id] }),
  driver: one(user, { fields: [trips.driverUserId], references: [user.id] }),
  organization: one(organizations, { fields: [trips.organizationId], references: [organizations.id] }),
  statusLogs: many(tripStatusLogs),
}))

export const tripStatusLogRelations = relations(tripStatusLogs, ({ one }) => ({
  trip: one(trips, { fields: [tripStatusLogs.tripId], references: [trips.id] }),
  driver: one(user, { fields: [tripStatusLogs.driverUserId], references: [user.id] }),
}))

export const vehicleRelations = relations(vehicles, ({ one, many }) => ({
  driver: one(user, { fields: [vehicles.driverUserId], references: [user.id] }),
  trips: many(trips),
}))

export const recurringScheduleRelations = relations(recurringSchedules, ({ one }) => ({
  careRecipient: one(careRecipients, { fields: [recurringSchedules.careRecipientId], references: [careRecipients.id] }),
  organization: one(organizations, { fields: [recurringSchedules.organizationId], references: [organizations.id] }),
}))

export const announcementRelations = relations(announcements, ({ one }) => ({
  author: one(user, { fields: [announcements.authorUserId], references: [user.id] }),
}))

export const carpoolGroupRelations = relations(carpoolGroups, ({ one, many }) => ({
  driver: one(user, { fields: [carpoolGroups.driverUserId], references: [user.id] }),
  vehicle: one(vehicles, { fields: [carpoolGroups.vehicleId], references: [vehicles.id] }),
  trips: many(trips),
}))

export const tripIncidentRelations = relations(tripIncidents, ({ one }) => ({
  trip: one(trips, { fields: [tripIncidents.tripId], references: [trips.id] }),
  driver: one(user, { fields: [tripIncidents.driverUserId], references: [user.id], relationName: 'incident_driver' }),
  resolvedBy: one(user, { fields: [tripIncidents.resolvedById], references: [user.id], relationName: 'incident_resolver' }),
}))
