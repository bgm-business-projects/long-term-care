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
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "effective_start_date" date;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "effective_end_date" date;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD COLUMN "estimated_duration" integer;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;