import { and, count, desc, eq, gte, inArray, max } from "drizzle-orm";
import { db } from "../client";
import {
  kasieIntegrations,
  kasieProjectConfig,
  kasieProjects,
  kasieRuns,
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
