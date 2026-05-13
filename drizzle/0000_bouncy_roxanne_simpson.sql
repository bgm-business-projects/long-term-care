CREATE TYPE "public"."driver_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('active', 'on_leave', 'resigned');--> statement-breakpoint
CREATE TYPE "public"."service_point_category" AS ENUM('hospital', 'rehab', 'other');--> statement-breakpoint
CREATE TYPE "public"."special_needs" AS ENUM('general', 'wheelchair', 'bedridden');--> statement-breakpoint
CREATE TYPE "public"."trip_log_status" AS ENUM('departed', 'arrived_origin', 'recipient_boarded', 'completed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"author_user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"contact_person" text,
	"contact_phone" text,
	"special_needs" "special_needs" DEFAULT 'general' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fleet_id" text,
	"phone" text NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"id_card_front_key" text,
	"id_card_back_key" text,
	"professional_license_key" text,
	"license_expiry" date,
	"approval_status" "driver_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_id" text,
	"rejection_reason" text,
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"unavailable_dates" text,
	"emergency_contact" text,
	"emergency_phone" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "driver_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "fleets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"address" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"care_recipient_id" text NOT NULL,
	"organization_id" text,
	"days_of_week" text NOT NULL,
	"departure_time" text NOT NULL,
	"origin_address" text NOT NULL,
	"origin_lat" numeric(10, 7),
	"origin_lng" numeric(10, 7),
	"destination_address" text NOT NULL,
	"destination_lat" numeric(10, 7),
	"destination_lng" numeric(10, 7),
	"needs_wheelchair" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"effective_start_date" date,
	"effective_end_date" date,
	"estimated_duration" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"tier" text NOT NULL,
	"duration_days" integer,
	"disabled" boolean DEFAULT false NOT NULL,
	"batch_id" text,
	"used_by_id" text,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "redemption_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service_points" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"care_recipient_id" text,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"category" "service_point_category" DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "trip_status_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"driver_user_id" text NOT NULL,
	"status" "trip_log_status" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"note" text
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"care_recipient_id" text NOT NULL,
	"vehicle_id" text,
	"driver_user_id" text,
	"organization_id" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone,
	"estimated_duration" integer,
	"origin_address" text NOT NULL,
	"origin_lat" numeric(10, 7),
	"origin_lng" numeric(10, 7),
	"destination_address" text NOT NULL,
	"destination_lat" numeric(10, 7),
	"destination_lng" numeric(10, 7),
	"status" "trip_status" DEFAULT 'pending' NOT NULL,
	"mileage_estimated" numeric(8, 2),
	"mileage_actual" numeric(8, 2),
	"needs_wheelchair" boolean DEFAULT false NOT NULL,
	"notes" text,
	"recurring_schedule_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"last_notified_tier" text DEFAULT 'free' NOT NULL,
	"consent_accepted_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"converted_from_guest_at" timestamp with time zone,
	"organization_id" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_user_id" text NOT NULL,
	"plate" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"seat_count" integer DEFAULT 4 NOT NULL,
	"wheelchair_capacity" integer DEFAULT 0 NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"is_rental" boolean DEFAULT false NOT NULL,
	"home_address" text,
	"home_lat" numeric(10, 7),
	"home_lng" numeric(10, 7),
	"vehicle_photo_key" text,
	"vehicle_registration_key" text,
	"compulsory_insurer" text,
	"insurance_expiry" date,
	"has_third_party_liability" boolean DEFAULT false NOT NULL,
	"has_passenger_liability" boolean DEFAULT false NOT NULL,
	"has_driver_injury" boolean DEFAULT false NOT NULL,
	"has_excess_liability" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vehicles_driver_user_id_unique" UNIQUE("driver_user_id"),
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_recipients" ADD CONSTRAINT "care_recipients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_care_recipient_id_care_recipients_id_fk" FOREIGN KEY ("care_recipient_id") REFERENCES "public"."care_recipients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_code" ADD CONSTRAINT "redemption_code_used_by_id_user_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_care_recipient_id_care_recipients_id_fk" FOREIGN KEY ("care_recipient_id") REFERENCES "public"."care_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_logs" ADD CONSTRAINT "trip_status_logs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_status_logs" ADD CONSTRAINT "trip_status_logs_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_care_recipient_id_care_recipients_id_fk" FOREIGN KEY ("care_recipient_id") REFERENCES "public"."care_recipients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;