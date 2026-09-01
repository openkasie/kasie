ALTER TABLE "kasie_project_config" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "kasie_project_config" ADD COLUMN "working_hours" jsonb;