import { and, count, desc, eq, gte, inArray, max, sql } from "drizzle-orm";
import { db } from "../client";
import {
  kasieIntegrations,
  kasiePendingActions,
  kasieProjectConfig,
  kasieProjects,
  kasieRuns,
  kasieSchedules,
} from "../schema";

const USER_RUN_SOURCES = ["slack", "api", "dashboard"] as const;

/** Projects with a connected Slack workspace, i.e. somewhere to deliver to. */
export async function listProactiveCandidateProjects() {
  return db
    .selectDistinct({
      projectId: kasieProjects.id,
      orgId: kasieProjects.orgId,
      agentName: kasieProjects.agentName,
      createdAt: kasieProjects.createdAt,
      proactiveEnabled: kasieProjectConfig.proactiveEnabled,
      timezone: kasieProjectConfig.timezone,
      workingHours: kasieProjectConfig.workingHours,
    })
    .from(kasieProjects)
    .innerJoin(
      kasieProjectConfig,
      eq(kasieProjectConfig.projectId, kasieProjects.id),
    )
    .innerJoin(
      kasieIntegrations,
      and(
        eq(kasieIntegrations.projectId, kasieProjects.id),
        eq(kasieIntegrations.appSlug, "slack"),
        eq(kasieIntegrations.status, "connected"),
      ),
    );
}

export async function getInitiativeGateStats(projectId: string, now: Date) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [[userRun], [initiative], [capRow]] = await Promise.all([
    db
      .select({ last: max(kasieRuns.createdAt) })
      .from(kasieRuns)
      .where(
        and(
          eq(kasieRuns.projectId, projectId),
          inArray(kasieRuns.source, [...USER_RUN_SOURCES]),
        ),
      ),
    db
      .select({ last: max(kasieRuns.createdAt) })
      .from(kasieRuns)
      .where(
        and(eq(kasieRuns.projectId, projectId), eq(kasieRuns.source, "initiative")),
      ),
    db
      .select({ total: count() })
      .from(kasieRuns)
      .where(
        and(
          eq(kasieRuns.projectId, projectId),
          eq(kasieRuns.source, "initiative"),
          gte(kasieRuns.createdAt, dayAgo),
        ),
      ),
  ]);

  return {
    lastUserRunAt: userRun?.last ?? null,
    lastInitiativeAt: initiative?.last ?? null,
    initiativesLast24h: capRow?.total ?? 0,
  };
}

export async function listRecentUserMessages(projectId: string, limit = 8) {
  const rows = await db
    .select({ input: kasieRuns.input, createdAt: kasieRuns.createdAt })
    .from(kasieRuns)
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        inArray(kasieRuns.source, [...USER_RUN_SOURCES]),
      ),
    )
    .orderBy(desc(kasieRuns.createdAt))
    .limit(limit);

  return rows
    .map((r) => {
      const message = (r.input as { message?: unknown }).message;
      return typeof message === "string" ? message.trim() : "";
    })
    .filter(Boolean);
}

/** Unresolved approvals for the project, newest first. */
export async function listPendingApprovals(projectId: string, limit = 10) {
  return db
    .select({
      toolName: kasiePendingActions.toolName,
      createdAt: kasiePendingActions.createdAt,
    })
    .from(kasiePendingActions)
    .innerJoin(kasieRuns, eq(kasieRuns.id, kasiePendingActions.runId))
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        eq(kasiePendingActions.status, "pending"),
      ),
    )
    .orderBy(desc(kasiePendingActions.createdAt))
    .limit(limit);
}

/** Texts of the most recent completed initiative runs, newest first. */
export async function listRecentInitiativeTexts(projectId: string, limit = 5) {
  const rows = await db
    .select({ output: kasieRuns.output })
    .from(kasieRuns)
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        eq(kasieRuns.source, "initiative"),
        eq(kasieRuns.status, "completed"),
      ),
    )
    .orderBy(desc(kasieRuns.createdAt))
    .limit(limit);

  return rows
    .map((r) => (r.output as { text?: unknown } | null)?.text)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());
}

/**
 * Enabled schedules whose last `minRuns` completed runs all replied with the
 * silence sentinel, i.e. they keep firing but never produce anything.
 */
export async function listSilentSchedules(
  projectId: string,
  sentinel: string,
  minRuns = 3,
) {
  const schedules = await db
    .select({ id: kasieSchedules.id, title: kasieSchedules.title })
    .from(kasieSchedules)
    .where(
      and(eq(kasieSchedules.projectId, projectId), eq(kasieSchedules.enabled, true)),
    );
  if (schedules.length === 0) return [];

  const runs = await db
    .select({
      scheduleId: sql<string | null>`${kasieRuns.input}->>'scheduleId'`,
      output: kasieRuns.output,
    })
    .from(kasieRuns)
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        eq(kasieRuns.source, "schedule"),
        eq(kasieRuns.status, "completed"),
      ),
    )
    .orderBy(desc(kasieRuns.createdAt))
    .limit(100);

  const bySchedule = new Map<string, string[]>();
  for (const run of runs) {
    if (!run.scheduleId) continue;
    const texts = bySchedule.get(run.scheduleId) ?? [];
    if (texts.length >= minRuns) continue;
    const text = (run.output as { text?: unknown } | null)?.text;
    texts.push(typeof text === "string" ? text.trim() : "");
    bySchedule.set(run.scheduleId, texts);
  }

  return schedules.filter((s) => {
    const texts = bySchedule.get(s.id);
    return texts?.length === minRuns && texts.every((t) => t === sentinel);
  });
}

export async function listConnectedIntegrationSlugs(projectId: string) {
  const rows = await db
    .select({ appSlug: kasieIntegrations.appSlug })
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.status, "connected"),
        eq(kasieIntegrations.enabled, true),
      ),
    );
  return rows.map((r) => r.appSlug);
}
