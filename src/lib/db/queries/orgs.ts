import { and, count, eq } from "drizzle-orm";
import { db } from "../client";
import {
  kasieAccounts,
  kasieOrgMembers,
  kasieOrgs,
  kasieProjects,
  kasieUsers,
} from "../schema";
import {
  bindProjectPlatformTeam,
  createProjectForOrg,
  setPrimaryChannel,
  upsertSlackIntegration,
} from "./projects";

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(kasieUsers)
    .where(eq(kasieUsers.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

export async function countUsers() {
  const [row] = await db.select({ total: count() }).from(kasieUsers);
  return row?.total ?? 0;
}

export async function canSlackSignIn(email: string) {
  if (await findUserByEmail(email)) return true;
  return (await countUsers()) === 0;
}

export async function createUserFromSlack(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  isSuperadmin?: boolean;
}) {
  const [user] = await db
    .insert(kasieUsers)
    .values({
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      image: input.image ?? null,
      isSuperadmin: input.isSuperadmin ?? false,
      emailVerified: new Date(),
    })
    .returning();
  return user;
}

export async function upsertSlackAccount(input: {
  userId: string;
  slackUserId: string;
}) {
  await db
    .insert(kasieAccounts)
    .values({
      userId: input.userId,
      type: "oidc",
      provider: "slack",
      providerAccountId: input.slackUserId,
    })
    .onConflictDoUpdate({
      target: [kasieAccounts.provider, kasieAccounts.providerAccountId],
      set: { userId: input.userId },
    });
}

export async function getSlackUserIdForUser(userId: string) {
  const [row] = await db
    .select({ slackUserId: kasieAccounts.providerAccountId })
    .from(kasieAccounts)
    .where(
      and(eq(kasieAccounts.userId, userId), eq(kasieAccounts.provider, "slack")),
    )
    .limit(1);
  return row?.slackUserId ?? null;
}

export async function provisionTenant(input: {
  userId: string;
  workspaceName: string;
  channel: string;
  slackTeamId: string;
  botToken: string;
}) {
  const org = await createOrgOwner({
    name: input.workspaceName,
    userId: input.userId,
  });
  const project = await createProjectForOrg({
    orgId: org.id,
    name: input.workspaceName,
    channel: input.channel,
  });
  await bindProjectPlatformTeam(project.id, input.slackTeamId);
  await upsertSlackIntegration(project.id, input.slackTeamId, input.botToken);
  await setPrimaryChannel(project.id, "slack");
  return { org, project };
}

export async function createOrgOwner(input: {
  name: string;
  userId: string;
}) {
  const [org] = await db
    .insert(kasieOrgs)
    .values({ name: input.name })
    .returning();
  await db.insert(kasieOrgMembers).values({
    userId: input.userId,
    orgId: org.id,
    role: "owner",
  });
  return org;
}

export async function getOrgById(orgId: string) {
  const [org] = await db
    .select()
    .from(kasieOrgs)
    .where(eq(kasieOrgs.id, orgId))
    .limit(1);
  return org ?? null;
}

export async function getOrgOwnerUserId(orgId: string) {
  const [row] = await db
    .select({ userId: kasieOrgMembers.userId })
    .from(kasieOrgMembers)
    .where(and(eq(kasieOrgMembers.orgId, orgId), eq(kasieOrgMembers.role, "owner")))
    .limit(1);
  return row?.userId ?? null;
}

export async function getOrgMembership(userId: string, orgId: string) {
  const [membership] = await db
    .select()
    .from(kasieOrgMembers)
    .where(
      and(eq(kasieOrgMembers.userId, userId), eq(kasieOrgMembers.orgId, orgId)),
    )
    .limit(1);
  return membership ?? null;
}

export async function hasProjectAccess(userId: string, projectId: string) {
  const [row] = await db
    .select({ userId: kasieOrgMembers.userId })
    .from(kasieProjects)
    .innerJoin(kasieOrgMembers, eq(kasieOrgMembers.orgId, kasieProjects.orgId))
    .where(
      and(eq(kasieProjects.id, projectId), eq(kasieOrgMembers.userId, userId)),
    )
    .limit(1);
  return Boolean(row);
}

export async function setUserSelectedProject(userId: string, projectId: string) {
  await db
    .update(kasieUsers)
    .set({ selectedProjectId: projectId })
    .where(eq(kasieUsers.id, userId));
}

export async function listProjectsForUser(userId: string) {
  return db
    .select({
      id: kasieProjects.id,
      name: kasieProjects.name,
      agentName: kasieProjects.agentName,
      orgId: kasieProjects.orgId,
      platformTeamId: kasieProjects.platformTeamId,
    })
    .from(kasieProjects)
    .innerJoin(kasieOrgMembers, eq(kasieOrgMembers.orgId, kasieProjects.orgId))
    .where(eq(kasieOrgMembers.userId, userId))
    .orderBy(kasieProjects.name);
}

export {
  getMemberUsageStats,
  getProjectUsageBreakdown,
  getScheduleUsageStats,
  getTeamUsageSummary,
  getUsageStats,
  listAuditEvents,
} from "./usage";

export async function listOrgMembers(orgId: string) {
  return db
    .select({
      userId: kasieOrgMembers.userId,
      role: kasieOrgMembers.role,
      name: kasieUsers.name,
      email: kasieUsers.email,
      image: kasieUsers.image,
    })
    .from(kasieOrgMembers)
    .innerJoin(kasieUsers, eq(kasieUsers.id, kasieOrgMembers.userId))
    .where(eq(kasieOrgMembers.orgId, orgId))
    .orderBy(kasieUsers.name);
}

export async function removeOrgMember(orgId: string, userId: string) {
  await db
    .delete(kasieOrgMembers)
    .where(
      and(eq(kasieOrgMembers.orgId, orgId), eq(kasieOrgMembers.userId, userId)),
    );
}
