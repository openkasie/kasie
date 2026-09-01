import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  kasieIntegrations,
  kasiePendingActions,
  kasieProjectConfig,
  kasieProjects,
  kasieRuns,
  kasieSchedules,
  kasieThreads,
} from "../schema";

export async function listProjects() {
  return db
    .select({
      id: kasieProjects.id,
      name: kasieProjects.name,
      agentName: kasieProjects.agentName,
      orgId: kasieProjects.orgId,
      platformTeamId: kasieProjects.platformTeamId,
    })
    .from(kasieProjects)
    .orderBy(kasieProjects.name);
}

export async function getProjectById(projectId: string) {
  const [project] = await db
    .select()
    .from(kasieProjects)
    .where(eq(kasieProjects.id, projectId))
    .limit(1);
  return project ?? null;
}

const PENDING_TEAM_PREFIX = "pending:";

export function isPendingPlatformTeam(platformTeamId: string) {
  return platformTeamId.startsWith(PENDING_TEAM_PREFIX);
}

function newPendingPlatformTeamId() {
  return `${PENDING_TEAM_PREFIX}${crypto.randomUUID()}`;
}

export async function createProjectForOrg(input: {
  orgId: string;
  name: string;
  channel: string;
}) {
  const [project] = await db
    .insert(kasieProjects)
    .values({
      name: input.name,
      orgId: input.orgId,
      platformTeamId: newPendingPlatformTeamId(),
      agentName: "Kasie",
      systemPrompt: `You are Kasie, the operations agent for ${input.name}.`,
    })
    .returning();

  await db.insert(kasieProjectConfig).values({
    projectId: project.id,
    personalityTone: "standard",
    modelTier: "smart",
    enabledSkillIds: [],
    channelBindings: { primary: input.channel },
  });

  return project;
}

export async function bindProjectPlatformTeam(
  projectId: string,
  platformTeamId: string,
) {
  const [updated] = await db
    .update(kasieProjects)
    .set({ platformTeamId, updatedAt: new Date() })
    .where(eq(kasieProjects.id, projectId))
    .returning();
  return updated ?? null;
}

export async function setPrimaryChannel(projectId: string, channel: string) {
  const config = await getProjectConfig(projectId);
  const bindings = { ...(config?.channelBindings ?? {}), primary: channel };
  if (config) {
    await db
      .update(kasieProjectConfig)
      .set({ channelBindings: bindings, updatedAt: new Date() })
      .where(eq(kasieProjectConfig.projectId, projectId));
    return;
  }
  await db.insert(kasieProjectConfig).values({
    projectId,
    channelBindings: bindings,
  });
}

export async function upsertSlackIntegration(
  projectId: string,
  teamId: string,
  botToken?: string,
) {
  const [existing] = await db
    .select()
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.appSlug, "slack"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(kasieIntegrations)
      .set({
        accountId: teamId,
        encryptedCredentialsRef: botToken ?? existing.encryptedCredentialsRef,
        status: "connected",
        updatedAt: new Date(),
      })
      .where(eq(kasieIntegrations.id, existing.id));
    return;
  }

  await db.insert(kasieIntegrations).values({
    projectId,
    appSlug: "slack",
    nickname: "Slack Workspace",
    visibility: "workspace",
    status: "connected",
    discoveryStatus: "completed",
    accountId: teamId,
    encryptedCredentialsRef: botToken,
  });
}

export async function getSlackBotToken(projectId: string) {
  const [row] = await db
    .select({ token: kasieIntegrations.encryptedCredentialsRef })
    .from(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.appSlug, "slack"),
      ),
    )
    .limit(1);
  return row?.token ?? null;
}

export async function disconnectSlackIntegration(projectId: string) {
  await db
    .delete(kasieIntegrations)
    .where(
      and(
        eq(kasieIntegrations.projectId, projectId),
        eq(kasieIntegrations.appSlug, "slack"),
      ),
    );

  await db
    .update(kasieProjects)
    .set({
      platformTeamId: newPendingPlatformTeamId(),
      updatedAt: new Date(),
    })
    .where(eq(kasieProjects.id, projectId));
}

export async function getProjectByTeamId(platformTeamId: string) {
  const [project] = await db
    .select()
    .from(kasieProjects)
    .where(eq(kasieProjects.platformTeamId, platformTeamId))
    .limit(1);
  return project ?? null;
}

export async function getProjectConfig(projectId: string) {
  const [config] = await db
    .select()
    .from(kasieProjectConfig)
    .where(eq(kasieProjectConfig.projectId, projectId))
    .limit(1);
  return config ?? null;
}

export async function getProjectWithConfig(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) return null;
  const config = await getProjectConfig(projectId);
  return { project, config };
}

export async function listIntegrations(projectId: string) {
  return db
    .select()
    .from(kasieIntegrations)
    .where(eq(kasieIntegrations.projectId, projectId));
}

export async function listRunsForProject(projectId: string, limit = 50) {
  return db
    .select()
    .from(kasieRuns)
    .where(eq(kasieRuns.projectId, projectId))
    .orderBy(desc(kasieRuns.createdAt))
    .limit(limit);
}

export async function getLatestRun(projectId: string) {
  const [run] = await db
    .select()
    .from(kasieRuns)
    .where(eq(kasieRuns.projectId, projectId))
    .orderBy(desc(kasieRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function listPendingActionsForProject(projectId: string) {
  return db
    .select({
      id: kasiePendingActions.id,
      runId: kasiePendingActions.runId,
      toolName: kasiePendingActions.toolName,
      payload: kasiePendingActions.payload,
      status: kasiePendingActions.status,
      createdAt: kasiePendingActions.createdAt,
    })
    .from(kasiePendingActions)
    .innerJoin(kasieRuns, eq(kasiePendingActions.runId, kasieRuns.id))
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        eq(kasiePendingActions.status, "pending"),
      ),
    );
}

export async function listSchedules(projectId: string) {
  return db
    .select()
    .from(kasieSchedules)
    .where(eq(kasieSchedules.projectId, projectId))
    .orderBy(desc(kasieSchedules.createdAt));
}

export async function countEnabledSchedules(projectId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(kasieSchedules)
    .where(
      and(eq(kasieSchedules.projectId, projectId), eq(kasieSchedules.enabled, true)),
    );
  return row?.total ?? 0;
}

export async function upsertThread(
  projectId: string,
  externalThreadKey: string,
  metadata?: Record<string, unknown>,
) {
  const [existing] = await db
    .select()
    .from(kasieThreads)
    .where(
      and(
        eq(kasieThreads.projectId, projectId),
        eq(kasieThreads.externalThreadKey, externalThreadKey),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [thread] = await db
    .insert(kasieThreads)
    .values({ projectId, externalThreadKey, metadata: metadata ?? {} })
    .returning();
  return thread;
}
