ALTER TYPE "public"."run_source" ADD VALUE 'initiative';--> statement-breakpoint
ALTER TABLE "kasie_project_config" ADD COLUMN "proactive_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD COLUMN "title" text DEFAULT 'Scheduled task' NOT NULL;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD COLUMN "last_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD COLUMN "next_run_at" timestamp with time zone;