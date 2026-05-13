-- 先 drop 舊的 special_needs enum 與使用它的欄位（會被新的 junction 表取代）
ALTER TABLE "care_recipients" DROP COLUMN IF EXISTS "special_needs";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."special_needs";--> statement-breakpoint

CREATE TABLE "care_recipient_special_needs" (
	"care_recipient_id" text NOT NULL,
	"special_need_id" text NOT NULL,
	CONSTRAINT "care_recipient_special_needs_care_recipient_id_special_need_id_pk" PRIMARY KEY("care_recipient_id","special_need_id")
);
--> statement-breakpoint
CREATE TABLE "special_needs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
