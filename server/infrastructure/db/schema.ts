import { pgTable, pgEnum, text, integer, boolean, timestamp, numeric, date } from 'drizzle-orm/pg-core'
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

export const specialNeedsEnum = pgEnum('special_needs', ['general', 'wheelchair', 'bedridden'])
export const tripStatusEnum = pgEnum('trip_status', ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
export const tripLogStatusEnum = pgEnum('trip_log_status', ['departed', 'arrived_origin', 'recipient_boarded', 'completed'])
export const servicePointCategoryEnum = pgEnum('service_point_category', ['hospital', 'rehab', 'other'])
export const driverStatusEnum = pgEnum('driver_status', ['active', 'on_leave', 'resigned'])

// ─── Dispatch System Tables ───────────────────────────────

export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  plate: text('plate').notNull().unique(),
  vehicleType: text('vehicle_type').notNull(),
  seatCount: integer('seat_count').notNull().default(4),
  hasWheelchairLift: boolean('has_wheelchair_lift').notNull().default(false),
  wheelchairCapacity: integer('wheelchair_capacity').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
})

export const driverProfiles = pgTable('driver_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  licenseExpiry: date('license_expiry', { mode: 'string' }),
  isActive: boolean('is_active').notNull().default(true),
  status: driverStatusEnum('status').notNull().default('active'),
  unavailableDates: text('unavailable_dates'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  canDriveWheelchairVan: boolean('can_drive_wheelchair_van').notNull().default(false),
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
  specialNeeds: specialNeedsEnum('special_needs').notNull().default('general'),
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
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
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
  user: one(user, { fields: [driverProfiles.userId], references: [user.id] }),
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

export const vehicleRelations = relations(vehicles, ({ many }) => ({
  trips: many(trips),
}))

export const recurringScheduleRelations = relations(recurringSchedules, ({ one }) => ({
  careRecipient: one(careRecipients, { fields: [recurringSchedules.careRecipientId], references: [careRecipients.id] }),
  organization: one(organizations, { fields: [recurringSchedules.organizationId], references: [organizations.id] }),
}))

export const announcementRelations = relations(announcements, ({ one }) => ({
  author: one(user, { fields: [announcements.authorUserId], references: [user.id] }),
}))
