CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'api_key', 'system', 'agent');--> statement-breakpoint
CREATE TYPE "public"."audit_event_category" AS ENUM('run', 'approval', 'schedule', 'admin', 'security');--> statement-breakpoint
CREATE TYPE "public"."run_source" AS ENUM('slack', 'api', 'schedule', 'dashboard', 'system');--> statement-breakpoint
CREATE TABLE "kasie_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid,
	"category" "audit_event_category" NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_label" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"resource_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_micros" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD COLUMN "source" "run_source";--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD COLUMN "initiated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD COLUMN "initiated_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "kasie_audit_events" ADD CONSTRAINT "kasie_audit_events_org_id_kasie_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kasie_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_audit_events" ADD CONSTRAINT "kasie_audit_events_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_audit_events" ADD CONSTRAINT "kasie_audit_events_actor_user_id_kasie_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."kasie_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kasie_audit_events_org_created_idx" ON "kasie_audit_events" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "kasie_audit_events_org_category_idx" ON "kasie_audit_events" USING btree ("org_id","category","created_at");--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD CONSTRAINT "kasie_runs_initiated_by_user_id_kasie_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."kasie_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD CONSTRAINT "kasie_runs_initiated_by_api_key_id_kasie_api_keys_id_fk" FOREIGN KEY ("initiated_by_api_key_id") REFERENCES "public"."kasie_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kasie_runs_source_idx" ON "kasie_runs" USING btree ("project_id","source");