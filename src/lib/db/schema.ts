import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const pendingActionStatusEnum = pgEnum("pending_action_status", [
  "pending",
  "approved",
  "rejected",
]);

export const modelTierEnum = pgEnum("model_tier", [
  "ultra",
  "smart",
  "balanced",
]);

export const integrationVisibilityEnum = pgEnum("integration_visibility", [
  "workspace",
  "private",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "pending",
  "connected",
  "error",
]);

export const integrationDiscoveryStatusEnum = pgEnum("integration_discovery_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const runSourceEnum = pgEnum("run_source", [
  "slack",
  "api",
  "schedule",
  "dashboard",
  "system",
  "initiative",
]);

export const auditEventCategoryEnum = pgEnum("audit_event_category", [
  "run",
  "approval",
  "schedule",
  "admin",
  "security",
]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "api_key",
  "system",
  "agent",
]);

export const kasieUsers = pgTable("kasie_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  selectedProjectId: uuid("selected_project_id").references(
    (): AnyPgColumn => kasieProjects.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieAccounts = pgTable(
  "kasie_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => kasieUsers.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const kasieSessions = pgTable("kasie_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => kasieUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const kasieVerificationTokens = pgTable(
  "kasie_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const kasieOrgs = pgTable("kasie_orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  monthlyBudgetCents: bigint("monthly_budget_cents", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieOrgMembers = pgTable(
  "kasie_org_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => kasieUsers.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => kasieOrgs.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | member
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);

export const kasieApiKeys = pgTable(
  "kasie_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => kasieOrgs.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => kasieUsers.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_api_keys_org_idx").on(t.orgId),
    index("kasie_api_keys_prefix_idx").on(t.keyPrefix),
  ],
);

export const kasieProjects = pgTable("kasie_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgId: uuid("org_id").references(() => kasieOrgs.id),
  platformTeamId: text("platform_team_id").notNull().unique(),
  agentName: text("agent_name").notNull().default("Kasie"),
  systemPrompt: text("system_prompt"),
  deployRegion: text("deploy_region"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieProjectConfig = pgTable("kasie_project_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => kasieProjects.id, { onDelete: "cascade" })
    .unique(),
  personalityTone: text("personality_tone").notNull().default("standard"),
  workspaceInstructions: text("workspace_instructions"),
  modelTier: modelTierEnum("model_tier").notNull().default("smart"),
  enabledSkillIds: jsonb("enabled_skill_ids").$type<string[]>().notNull().default([]),
  channelBindings: jsonb("channel_bindings").$type<Record<string, string>>().notNull().default({}),
  proactiveEnabled: boolean("proactive_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieThreads = pgTable(
  "kasie_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id, { onDelete: "cascade" }),
    externalThreadKey: text("external_thread_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_threads_project_external_idx").on(t.projectId, t.externalThreadKey),
  ],
);

export const kasieRuns = pgTable(
  "kasie_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => kasieThreads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id, { onDelete: "cascade" }),
    status: runStatusEnum("status").notNull().default("queued"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb("output").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    source: runSourceEnum("source"),
    initiatedByUserId: uuid("initiated_by_user_id").references(() => kasieUsers.id, {
      onDelete: "set null",
    }),
    initiatedByApiKeyId: uuid("initiated_by_api_key_id").references(
      () => kasieApiKeys.id,
      { onDelete: "set null" },
    ),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_runs_project_idx").on(t.projectId),
    index("kasie_runs_idempotency_idx").on(t.projectId, t.idempotencyKey),
    index("kasie_runs_source_idx").on(t.projectId, t.source),
  ],
);

export const kasieMemories = pgTable(
  "kasie_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id, { onDelete: "cascade" }),
    entity: text("entity").notNull(),
    relation: text("relation").notNull(),
    target: text("target").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [index("kasie_memories_project_idx").on(t.projectId)],
);

export const kasieInteractions = pgTable("kasie_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => kasieRuns.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieIntegrations = pgTable(
  "kasie_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id, { onDelete: "cascade" }),
    appSlug: text("app_slug").notNull(),
    nickname: text("nickname").notNull().default("Account"),
    visibility: integrationVisibilityEnum("visibility").notNull().default("workspace"),
    createdByUserId: uuid("created_by_user_id").references(() => kasieUsers.id, {
      onDelete: "set null",
    }),
    status: integrationStatusEnum("status").notNull().default("pending"),
    discoveryStatus: integrationDiscoveryStatusEnum("discovery_status")
      .notNull()
      .default("pending"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    discoverySummary: text("discovery_summary"),
    enabled: boolean("enabled").notNull().default(true),
    toolPolicies: jsonb("tool_policies")
      .$type<Record<string, "auto" | "approval" | "disabled">>()
      .default({}),
    accountId: text("account_id"),
    encryptedCredentialsRef: text("encrypted_credentials_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_integrations_project_app_idx").on(t.projectId, t.appSlug),
  ],
);

export const kasiePendingActions = pgTable("kasie_pending_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => kasieRuns.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  riskLevel: text("risk_level").notNull().default("write"),
  status: pendingActionStatusEnum("status").notNull().default("pending"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieSchedules = pgTable("kasie_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => kasieProjects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Scheduled task"),
  cron: text("cron").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  prompt: text("prompt").notNull(),
  // Slack channel ID for delivery; null falls back to a DM to the org owner.
  channel: text("channel"),
  enabled: boolean("enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kasieQueueJobs = pgTable(
  "kasie_queue_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => kasieRuns.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: text("attempts").notNull().default("0"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("kasie_queue_jobs_status_idx").on(t.status, t.createdAt)],
);

export const kasieAuditEvents = pgTable(
  "kasie_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => kasieOrgs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => kasieProjects.id, {
      onDelete: "set null",
    }),
    category: auditEventCategoryEnum("category").notNull(),
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => kasieUsers.id, {
      onDelete: "set null",
    }),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorLabel: text("actor_label").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    resourceLabel: text("resource_label"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    costMicros: bigint("cost_micros", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_audit_events_org_created_idx").on(t.orgId, t.createdAt),
    index("kasie_audit_events_org_category_idx").on(
      t.orgId,
      t.category,
      t.createdAt,
    ),
  ],
);

// Append-only per-run usage. estimated_cost_micros is list-price USD * 1e6.
export const kasieUsageLedger = pgTable(
  "kasie_usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => kasieOrgs.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => kasieProjects.id),
    runId: uuid("run_id")
      .notNull()
      .references(() => kasieRuns.id),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    modelTier: modelTierEnum("model_tier").notNull(),
    estimatedCostMicros: bigint("estimated_cost_micros", {
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kasie_usage_ledger_org_idx").on(t.orgId, t.createdAt),
    uniqueIndex("usage_ledger_run_unique").on(t.runId),
  ],
);

export type User = typeof kasieUsers.$inferSelect;
export type Org = typeof kasieOrgs.$inferSelect;
export type OrgMember = typeof kasieOrgMembers.$inferSelect;
export type ApiKey = typeof kasieApiKeys.$inferSelect;
export type UsageLedgerEntry = typeof kasieUsageLedger.$inferSelect;
export type AuditEvent = typeof kasieAuditEvents.$inferSelect;
export type RunSource = (typeof runSourceEnum.enumValues)[number];
export type AuditEventCategory = (typeof auditEventCategoryEnum.enumValues)[number];
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
export type Project = typeof kasieProjects.$inferSelect;
export type ProjectConfig = typeof kasieProjectConfig.$inferSelect;
export type Thread = typeof kasieThreads.$inferSelect;
export type Run = typeof kasieRuns.$inferSelect;
export type Memory = typeof kasieMemories.$inferSelect;
export type PendingAction = typeof kasiePendingActions.$inferSelect;
export type Schedule = typeof kasieSchedules.$inferSelect;
