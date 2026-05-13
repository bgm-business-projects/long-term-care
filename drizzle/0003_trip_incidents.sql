CREATE TYPE "public"."incident_type" AS ENUM('sick', 'missing', 'no_show', 'accident', 'other');--> statement-breakpoint
CREATE TABLE "trip_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"driver_user_id" text NOT NULL,
	"type" "incident_type" NOT NULL,
	"description" text,
	"reported_at" timestamp with time zone NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" text,
	"resolution_note" text
);
--> statement-breakpoint
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_incidents" ADD CONSTRAINT "trip_incidents_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
