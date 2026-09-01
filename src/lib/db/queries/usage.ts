import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../client";
import {
  kasieApiKeys,
  kasieAuditEvents,
  kasieOrgMembers,
  kasieOrgs,
  kasieProjects,
  kasieRuns,
  kasieSchedules,
  kasieUsageLedger,
  kasieUsers,
  type AuditEventCategory,
} from "../schema";
import { MEMBER_VISIBLE_CATEGORIES } from "@/lib/audit/categories";
import { utcMonthStart } from "@/lib/usage/cost";

export type AuditEventFilters = {
  since?: Date;
  category?: AuditEventCategory;
  categories?: AuditEventCategory[];
  actorUserId?: string;
  projectId?: string;
  search?: string;
  includeOwnerOnly?: boolean;
  cursor?: Date;
  offset?: number;
  limit?: number;
};

export async function listAuditEvents(orgId: string, filters: AuditEventFilters = {}) {
  const {
    since,
    category,
    categories,
    actorUserId,
    projectId,
    search,
    includeOwnerOnly = false,
    cursor,
    offset = 0,
    limit = 50,
  } = filters;

  const conditions = [eq(kasieAuditEvents.orgId, orgId)];

  if (!includeOwnerOnly) {
    conditions.push(inArray(kasieAuditEvents.category, MEMBER_VISIBLE_CATEGORIES));
  }
  if (since) conditions.push(gte(kasieAuditEvents.createdAt, since));
  if (cursor) conditions.push(lt(kasieAuditEvents.createdAt, cursor));
  if (category) conditions.push(eq(kasieAuditEvents.category, category));
  else if (categories?.length) {
    conditions.push(inArray(kasieAuditEvents.category, categories));
  }
  if (actorUserId) conditions.push(eq(kasieAuditEvents.actorUserId, actorUserId));
  if (projectId) conditions.push(eq(kasieAuditEvents.projectId, projectId));

  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        sql`${kasieAuditEvents.action} ILIKE ${q}`,
        sql`${kasieAuditEvents.resourceLabel} ILIKE ${q}`,
        sql`${kasieAuditEvents.actorLabel} ILIKE ${q}`,
      )!,
    );
  }

  return db
    .select({
      id: kasieAuditEvents.id,
      orgId: kasieAuditEvents.orgId,
      projectId: kasieAuditEvents.projectId,
      category: kasieAuditEvents.category,
      action: kasieAuditEvents.action,
      actorUserId: kasieAuditEvents.actorUserId,
      actorType: kasieAuditEvents.actorType,
      actorLabel: kasieAuditEvents.actorLabel,
      resourceType: kasieAuditEvents.resourceType,
      resourceId: kasieAuditEvents.resourceId,
      resourceLabel: kasieAuditEvents.resourceLabel,
      metadata: kasieAuditEvents.metadata,
      costMicros: kasieAuditEvents.costMicros,
      createdAt: kasieAuditEvents.createdAt,
      projectName: kasieProjects.name,
      actorName: kasieUsers.name,
      actorEmail: kasieUsers.email,
      actorImage: kasieUsers.image,
    })
    .from(kasieAuditEvents)
    .leftJoin(kasieProjects, eq(kasieProjects.id, kasieAuditEvents.projectId))
    .leftJoin(kasieUsers, eq(kasieUsers.id, kasieAuditEvents.actorUserId))
    .where(and(...conditions))
    .orderBy(desc(kasieAuditEvents.createdAt))
    .offset(offset)
    .limit(limit);
}

export async function exportAuditEvents(orgId: string, filters: AuditEventFilters = {}) {
  return listAuditEvents(orgId, { ...filters, limit: 10_000 });
}

export type MemberUsageRow = {
  key: string;
  label: string;
  image: string | null;
  runCount: number;
  spendMicros: number;
  lastActivity: Date | null;
};

export async function getMemberUsageStats(orgId: string, since: Date): Promise<MemberUsageRow[]> {
  const rows = await db
    .select({
      userId: kasieRuns.initiatedByUserId,
      apiKeyId: kasieRuns.initiatedByApiKeyId,
      source: kasieRuns.source,
      costMicros: kasieUsageLedger.estimatedCostMicros,
      createdAt: kasieUsageLedger.createdAt,
      userName: kasieUsers.name,
      userEmail: kasieUsers.email,
      userImage: kasieUsers.image,
      apiKeyName: kasieApiKeys.name,
    })
    .from(kasieUsageLedger)
    .innerJoin(kasieRuns, eq(kasieRuns.id, kasieUsageLedger.runId))
    .leftJoin(kasieUsers, eq(kasieUsers.id, kasieRuns.initiatedByUserId))
    .leftJoin(kasieApiKeys, eq(kasieApiKeys.id, kasieRuns.initiatedByApiKeyId))
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        gte(kasieUsageLedger.createdAt, since),
      ),
    );

  const map = new Map<string, MemberUsageRow>();

  for (const row of rows) {
    let key: string;
    let label: string;
    let image: string | null = null;

    if (row.userId) {
      key = `user:${row.userId}`;
      label = row.userName ?? row.userEmail ?? "Unknown user";
      image = row.userImage;
    } else if (row.apiKeyId) {
      key = `api:${row.apiKeyId}`;
      label = row.apiKeyName ? `API: ${row.apiKeyName}` : "Agent API";
    } else if (row.source === "slack") {
      key = "source:slack";
      label = "Slack";
    } else if (row.source === "schedule") {
      key = "source:schedule";
      label = "Scheduled tasks";
    } else if (row.source === "system") {
      key = "source:system";
      label = "System";
    } else {
      key = "source:unknown";
      label = "Unknown";
    }

    const existing = map.get(key);
    if (existing) {
      existing.runCount += 1;
      existing.spendMicros += row.costMicros;
      if (!existing.lastActivity || row.createdAt > existing.lastActivity) {
        existing.lastActivity = row.createdAt;
      }
    } else {
      map.set(key, {
        key,
        label,
        image,
        runCount: 1,
        spendMicros: row.costMicros,
        lastActivity: row.createdAt,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.spendMicros - a.spendMicros);
}

export type ProjectUsageRow = {
  projectId: string;
  name: string;
  runCount: number;
  spendMicros: number;
};

export async function getProjectUsageBreakdown(
  orgId: string,
  since: Date,
): Promise<ProjectUsageRow[]> {
  const rows = await db
    .select({
      projectId: kasieUsageLedger.projectId,
      name: kasieProjects.name,
      costMicros: kasieUsageLedger.estimatedCostMicros,
    })
    .from(kasieUsageLedger)
    .innerJoin(kasieProjects, eq(kasieProjects.id, kasieUsageLedger.projectId))
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        gte(kasieUsageLedger.createdAt, since),
      ),
    );

  const map = new Map<string, ProjectUsageRow>();
  for (const row of rows) {
    const existing = map.get(row.projectId);
    if (existing) {
      existing.runCount += 1;
      existing.spendMicros += row.costMicros;
    } else {
      map.set(row.projectId, {
        projectId: row.projectId,
        name: row.name,
        runCount: 1,
        spendMicros: row.costMicros,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.spendMicros - a.spendMicros);
}

export type DailySourceUsage = {
  date: string;
  slack: number;
  api: number;
  schedule: number;
  other: number;
};

export async function getUsageStats(orgId: string, days = 30) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const [org] = await db
    .select()
    .from(kasieOrgs)
    .where(eq(kasieOrgs.id, orgId))
    .limit(1);
  if (!org) return null;

  const entries = await db
    .select({
      estimatedCostMicros: kasieUsageLedger.estimatedCostMicros,
      createdAt: kasieUsageLedger.createdAt,
      source: kasieRuns.source,
    })
    .from(kasieUsageLedger)
    .innerJoin(kasieRuns, eq(kasieRuns.id, kasieUsageLedger.runId))
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        gte(kasieUsageLedger.createdAt, since),
      ),
    )
    .orderBy(kasieUsageLedger.createdAt);

  const dailyMap = new Map<string, DailySourceUsage>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, slack: 0, api: 0, schedule: 0, other: 0 });
  }

  let totalSpendMicros = 0;
  for (const entry of entries) {
    totalSpendMicros += entry.estimatedCostMicros;
    const key = entry.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(key);
    if (!day) continue;

    if (entry.source === "slack") day.slack += entry.estimatedCostMicros;
    else if (entry.source === "api") day.api += entry.estimatedCostMicros;
    else if (entry.source === "schedule") day.schedule += entry.estimatedCostMicros;
    else day.other += entry.estimatedCostMicros;
  }

  const dailySourceData = [...dailyMap.values()];
  const dailyData = dailySourceData.map((d) => ({
    date: d.date,
    amount: d.slack + d.api + d.schedule + d.other,
  }));

  const monthStart = utcMonthStart();
  const [monthRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${kasieUsageLedger.estimatedCostMicros}), 0)`,
    })
    .from(kasieUsageLedger)
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        gte(kasieUsageLedger.createdAt, monthStart),
      ),
    );

  const burnRateMicros = days > 0 ? Math.round(totalSpendMicros / days) : 0;

  return {
    monthlyBudgetCents: org.monthlyBudgetCents,
    totalSpendMicros,
    monthSpendMicros: Number(monthRow?.total ?? 0),
    burnRateMicros,
    dailyData,
    dailySourceData,
  };
}

export type ScheduleUsageRow = {
  scheduleId: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  runCount: number;
  avgCostMicros: number;
  totalCostMicros: number;
  lastActivity: Date | null;
};

export async function getScheduleUsageStats(
  orgId: string,
  since: Date,
): Promise<ScheduleUsageRow[]> {
  const schedules = await db
    .select({
      id: kasieSchedules.id,
      prompt: kasieSchedules.prompt,
      cron: kasieSchedules.cron,
      enabled: kasieSchedules.enabled,
      projectId: kasieSchedules.projectId,
    })
    .from(kasieSchedules)
    .innerJoin(kasieProjects, eq(kasieProjects.id, kasieSchedules.projectId))
    .where(eq(kasieProjects.orgId, orgId));

  if (schedules.length === 0) return [];

  const scheduleIds = schedules.map((s) => s.id);
  const runs = await db
    .select({
      scheduleId: sql<string>`${kasieRuns.input}->>'scheduleId'`,
      costMicros: kasieUsageLedger.estimatedCostMicros,
      createdAt: kasieUsageLedger.createdAt,
    })
    .from(kasieUsageLedger)
    .innerJoin(kasieRuns, eq(kasieRuns.id, kasieUsageLedger.runId))
    .where(
      and(
        eq(kasieUsageLedger.orgId, orgId),
        eq(kasieRuns.source, "schedule"),
        gte(kasieUsageLedger.createdAt, since),
        sql`${kasieRuns.input}->>'scheduleId' IN (${sql.join(
          scheduleIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );

  const stats = new Map<string, { runCount: number; totalCostMicros: number; lastActivity: Date | null }>();
  for (const row of runs) {
    if (!row.scheduleId) continue;
    const existing = stats.get(row.scheduleId);
    if (existing) {
      existing.runCount += 1;
      existing.totalCostMicros += row.costMicros;
      if (!existing.lastActivity || row.createdAt > existing.lastActivity) {
        existing.lastActivity = row.createdAt;
      }
    } else {
      stats.set(row.scheduleId, {
        runCount: 1,
        totalCostMicros: row.costMicros,
        lastActivity: row.createdAt,
      });
    }
  }

  return schedules.map((schedule) => {
    const usage = stats.get(schedule.id);
    const runCount = usage?.runCount ?? 0;
    const totalCostMicros = usage?.totalCostMicros ?? 0;
    return {
      scheduleId: schedule.id,
      prompt: schedule.prompt,
      cron: schedule.cron,
      enabled: schedule.enabled,
      runCount,
      avgCostMicros: runCount > 0 ? Math.round(totalCostMicros / runCount) : 0,
      totalCostMicros,
      lastActivity: usage?.lastActivity ?? null,
    };
  }).sort((a, b) => b.totalCostMicros - a.totalCostMicros);
}

export async function getTeamUsageSummary(orgId: string, since: Date) {
  const [memberCount] = await db
    .select({ total: count() })
    .from(kasieOrgMembers)
    .where(eq(kasieOrgMembers.orgId, orgId));

  const members = await getMemberUsageStats(orgId, since);
  return {
    activeMemberCount: memberCount?.total ?? 0,
    members,
  };
}
