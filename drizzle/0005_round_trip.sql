ALTER TABLE "trips" ADD COLUMN "paired_trip_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "trip_direction" text;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "round_trip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "return_departure_time" text;
