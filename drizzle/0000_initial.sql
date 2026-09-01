CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."integration_discovery_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('pending', 'connected', 'error');--> statement-breakpoint
CREATE TYPE "public"."integration_visibility" AS ENUM('workspace', 'private');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('ultra', 'smart', 'balanced');--> statement-breakpoint
CREATE TYPE "public"."pending_action_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "kasie_accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "kasie_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "kasie_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"app_slug" text NOT NULL,
	"nickname" text DEFAULT 'Account' NOT NULL,
	"visibility" "integration_visibility" DEFAULT 'workspace' NOT NULL,
	"created_by_user_id" uuid,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"discovery_status" "integration_discovery_status" DEFAULT 'pending' NOT NULL,
	"discovered_at" timestamp with time zone,
	"discovery_summary" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"tool_policies" jsonb DEFAULT '{}'::jsonb,
	"account_id" text,
	"encrypted_credentials_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"relation" text NOT NULL,
	"target" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "kasie_org_members" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	CONSTRAINT "kasie_org_members_user_id_org_id_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "kasie_orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"monthly_budget_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_level" text DEFAULT 'write' NOT NULL,
	"status" "pending_action_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_project_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"personality_tone" text DEFAULT 'standard' NOT NULL,
	"workspace_instructions" text,
	"model_tier" "model_tier" DEFAULT 'smart' NOT NULL,
	"enabled_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channel_bindings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kasie_project_config_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "kasie_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"org_id" uuid,
	"platform_team_id" text NOT NULL,
	"agent_name" text DEFAULT 'Kasie' NOT NULL,
	"system_prompt" text,
	"deploy_region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kasie_projects_platform_team_id_unique" UNIQUE("platform_team_id")
);
--> statement-breakpoint
CREATE TABLE "kasie_queue_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" text DEFAULT '0' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"idempotency_key" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cron" text NOT NULL,
	"prompt" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"external_thread_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"model_tier" "model_tier" NOT NULL,
	"estimated_cost_micros" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kasie_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"selected_project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kasie_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "kasie_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "kasie_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "kasie_accounts" ADD CONSTRAINT "kasie_accounts_user_id_kasie_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."kasie_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_api_keys" ADD CONSTRAINT "kasie_api_keys_org_id_kasie_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kasie_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_api_keys" ADD CONSTRAINT "kasie_api_keys_created_by_kasie_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."kasie_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_integrations" ADD CONSTRAINT "kasie_integrations_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_integrations" ADD CONSTRAINT "kasie_integrations_created_by_user_id_kasie_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."kasie_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_interactions" ADD CONSTRAINT "kasie_interactions_run_id_kasie_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."kasie_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_memories" ADD CONSTRAINT "kasie_memories_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_org_members" ADD CONSTRAINT "kasie_org_members_user_id_kasie_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."kasie_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_org_members" ADD CONSTRAINT "kasie_org_members_org_id_kasie_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kasie_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_pending_actions" ADD CONSTRAINT "kasie_pending_actions_run_id_kasie_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."kasie_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_project_config" ADD CONSTRAINT "kasie_project_config_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_projects" ADD CONSTRAINT "kasie_projects_org_id_kasie_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kasie_orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_queue_jobs" ADD CONSTRAINT "kasie_queue_jobs_run_id_kasie_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."kasie_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_queue_jobs" ADD CONSTRAINT "kasie_queue_jobs_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD CONSTRAINT "kasie_runs_thread_id_kasie_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."kasie_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_runs" ADD CONSTRAINT "kasie_runs_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_schedules" ADD CONSTRAINT "kasie_schedules_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_sessions" ADD CONSTRAINT "kasie_sessions_user_id_kasie_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."kasie_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_threads" ADD CONSTRAINT "kasie_threads_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_usage_ledger" ADD CONSTRAINT "kasie_usage_ledger_org_id_kasie_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."kasie_orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_usage_ledger" ADD CONSTRAINT "kasie_usage_ledger_project_id_kasie_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_usage_ledger" ADD CONSTRAINT "kasie_usage_ledger_run_id_kasie_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."kasie_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kasie_users" ADD CONSTRAINT "kasie_users_selected_project_id_kasie_projects_id_fk" FOREIGN KEY ("selected_project_id") REFERENCES "public"."kasie_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kasie_api_keys_org_idx" ON "kasie_api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "kasie_api_keys_prefix_idx" ON "kasie_api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "kasie_integrations_project_app_idx" ON "kasie_integrations" USING btree ("project_id","app_slug");--> statement-breakpoint
CREATE INDEX "kasie_memories_project_idx" ON "kasie_memories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "kasie_queue_jobs_status_idx" ON "kasie_queue_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "kasie_runs_project_idx" ON "kasie_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "kasie_runs_idempotency_idx" ON "kasie_runs" USING btree ("project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "kasie_threads_project_external_idx" ON "kasie_threads" USING btree ("project_id","external_thread_key");--> statement-breakpoint
CREATE INDEX "kasie_usage_ledger_org_idx" ON "kasie_usage_ledger" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_run_unique" ON "kasie_usage_ledger" USING btree ("run_id");