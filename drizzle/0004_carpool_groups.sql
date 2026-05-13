CREATE TYPE "public"."carpool_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint

CREATE TABLE "carpool_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_user_id" text,
	"vehicle_id" text,
	"destination_address" text NOT NULL,
	"destination_lat" numeric(10, 7),
	"destination_lng" numeric(10, 7),
	"scheduled_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone,
	"status" "carpool_status" DEFAULT 'planned' NOT NULL,
	"total_distance_meters" integer,
	"total_duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "trips" ADD COLUMN "carpool_group_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "carpool_order" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "carpool_pickup_at" timestamp with time zone;
