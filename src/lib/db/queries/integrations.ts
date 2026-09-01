import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "../client";
import { kasieIntegrations, kasieUsers } from "../schema";

export type IntegrationVisibility = "workspace" | "private";
export type IntegrationDiscoveryStatus = "pending" | "running" | "completed" | "failed";

export async function getIntegrationById(projectId: string, integrationId: string) {
  const [row] = await db
    .select()
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.id, integrationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listAccessibleIntegrations(
  projectId: string,
  userId?: string,
) {
  const rows = await db
    .select()
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.status, "connected"),
      ),
    );

  if (!userId) return rows.filter((r) => r.visibility === "workspace");

  return rows.filter(
    (r) =>
      r.visibility === "workspace" ||
      (r.visibility === "private" && r.createdByUserId === userId),
  );
}

export async function listPipedreamIntegrations(projectId: string) {
  return db
    .select()
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        ne(kasieIntegrations.appSlug, "slack"),
      ),
    );
}

export async function listConnectedIntegrationsByApp(
  projectId: string,
  appSlug: string,
  userId?: string,
) {
  const rows = await db
    .select({
      integration: kasieIntegrations,
      creatorName: kasieUsers.name,
      creatorEmail: kasieUsers.email,
    })
    .from(kasieIntegrations)
    .leftJoin(kasieUsers, eq(kasieUsers.id, kasieIntegrations.createdByUserId))
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.appSlug, appSlug),
        eq(kasieIntegrations.status, "connected"),
      ),
    );

  if (!userId) {
    return rows.filter((r) => r.integration.visibility === "workspace");
  }

  return rows.filter(
    (r) =>
      r.integration.visibility === "workspace" ||
      (r.integration.visibility === "private" &&
        r.integration.createdByUserId === userId),
  );
}

export async function countConnectedIntegrationsByApp(
  projectId: string,
  appSlug: string,
) {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.appSlug, appSlug),
        eq(kasieIntegrations.status, "connected"),
      ),
    );
  return row?.total ?? 0;
}

export async function createPendingIntegration(input: {
  projectId: string;
  appSlug: string;
  nickname: string;
  visibility: IntegrationVisibility;
  createdByUserId: string;
}) {
  const [row] = await db
    .insert(kasieIntegrations)
    .values({
      projectId: input.projectId,
      appSlug: input.appSlug,
      nickname: input.nickname,
      visibility: input.visibility,
      createdByUserId: input.createdByUserId,
      status: "pending",
      discoveryStatus: "pending",
    })
    .returning();
  return row;
}

export async function updateIntegration(
  projectId: string,
  integrationId: string,
  patch: {
    nickname?: string;
    visibility?: IntegrationVisibility;
    enabled?: boolean;
    toolPolicies?: Record<string, "auto" | "approval" | "disabled">;
  },
) {
  const [row] = await db
    .update(kasieIntegrations)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(kasieIntegrations.id, integrationId),
        eq(kasieIntegrations.projectId, projectId),
        ne(kasieIntegrations.appSlug, "slack"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function completeIntegration(input: {
  projectId: string;
  integrationId: string;
  accountId: string;
}) {
  const [row] = await db
    .update(kasieIntegrations)
    .set({
      accountId: input.accountId,
      status: "connected",
      discoveryStatus: "pending",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(kasieIntegrations.id, input.integrationId),
        eq(kasieIntegrations.projectId, input.projectId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function completeIntegrationByAccount(input: {
  projectId: string;
  appSlug: string;
  accountId: string;
  createdByUserId?: string;
}) {
  const [row] = await db
    .select()
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, input.projectId),
        eq(kasieIntegrations.appSlug, input.appSlug),
        or(
          eq(kasieIntegrations.status, "pending"),
          eq(kasieIntegrations.status, "connected"),
        ),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [updated] = await db
    .update(kasieIntegrations)
    .set({
      accountId: input.accountId,
      status: "connected",
      discoveryStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(kasieIntegrations.id, row.id))
    .returning();
  return updated ?? null;
}

export async function updateDiscoveryStatus(
  integrationId: string,
  discoveryStatus: IntegrationDiscoveryStatus,
  patch?: { discoverySummary?: string; discoveredAt?: Date },
) {
  await db
    .update(kasieIntegrations)
    .set({
      discoveryStatus,
      discoverySummary: patch?.discoverySummary,
      discoveredAt: patch?.discoveredAt,
      updatedAt: new Date(),
    })
    .where(eq(kasieIntegrations.id, integrationId));
}

export async function disconnectIntegration(
  projectId: string,
  integrationId: string,
) {
  await db
    .delete(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.id, integrationId),
        eq(kasieIntegrations.projectId, projectId),
        ne(kasieIntegrations.appSlug, "slack"),
      ),
    );
}
