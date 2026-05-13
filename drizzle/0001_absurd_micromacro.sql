CREATE TABLE "assistive_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_recipient_devices" (
	"care_recipient_id" text NOT NULL,
	"device_id" text NOT NULL,
	CONSTRAINT "care_recipient_devices_care_recipient_id_device_id_pk" PRIMARY KEY("care_recipient_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "trip_devices" (
	"trip_id" text NOT NULL,
	"device_id" text NOT NULL,
	CONSTRAINT "trip_devices_trip_id_device_id_pk" PRIMARY KEY("trip_id","device_id")
);
