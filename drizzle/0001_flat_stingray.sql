CREATE TYPE "public"."driver_status" AS ENUM('active', 'on_leave', 'resigned');--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "status" "driver_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "unavailable_dates" text;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "emergency_contact" text;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "can_drive_wheelchair_van" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "scheduled_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "estimated_duration" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;