"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import {
  createOrgApiKey,
  listOrgApiKeys,
  revokeOrgApiKey,
} from "@/lib/db/queries/api-keys";
import {
  countUsers,
  getOrgMembership,
  listOrgMembers,
} from "@/lib/db/queries/orgs";
import {
  disconnectSlackIntegration,
  getProjectById,
} from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { AuditActions, actorFromSession, recordAuditEvent } from "@/lib/audit";
import { hasSlackOAuth } from "@/lib/env";
import {
  slackOAuthAuthorizeUrl,
  signSlackOAuthState,
} from "@/lib/slack/oauth";
import { db } from "@/lib/db/client";
import { kasieUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(64),
});

const reconnectSchema = z.object({
  projectId: z.string().uuid(),
  origin: z.string().url(),
});

async function requireOrgOwner(orgId: string) {
  const { session, projectId } = await requireActiveProject();
  const membership = await getOrgMembership(session.user.id, orgId);
  if (membership?.role !== "owner" && !session.user.isSuperadmin) {
    throw new Error("forbidden");
  }
  return { session, projectId };
}

export async function listProjectApiKeys() {
  const { projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return [];

  return listOrgApiKeys(project.orgId);
}

export async function createProjectApiKey(
  raw: unknown,
): Promise<
  | { ok: true; secret: string }
  | { ok: false; error: string }
> {
  const parsed = createKeySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const { projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  let session;
  try {
    ({ session } = await requireOrgOwner(project.orgId));
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const { raw: secret, row: key } = await createOrgApiKey({
    orgId: project.orgId,
    name: parsed.data.name,
    createdBy: session.user.id,
  });

  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    action: AuditActions.apiKeyCreated,
    ...actorFromSession(session.user),
    resourceType: "api_key",
    resourceId: key.id,
    resourceLabel: parsed.data.name,
    metadata: { keyPrefix: key.keyPrefix },
  });

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true, secret };
}

export async function revokeProjectApiKey(
  keyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  let session;
  try {
    ({ session } = await requireOrgOwner(project.orgId));
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const keys = await listOrgApiKeys(project.orgId);
  const key = keys.find((k) => k.id === keyId);

  const revoked = await revokeOrgApiKey(project.orgId, keyId);
  if (!revoked) return { ok: false, error: "not found" };

  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    action: AuditActions.apiKeyRevoked,
    ...actorFromSession(session.user),
    resourceType: "api_key",
    resourceId: keyId,
    resourceLabel: key?.name ?? keyId,
    metadata: { keyPrefix: key?.keyPrefix ?? null },
  });

  revalidatePath("/dashboard/settings/api-keys");
  return { ok: true };
}

export async function disconnectSlackAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  let session;
  try {
    ({ session } = await requireOrgOwner(project.orgId));
  } catch {
    return { ok: false, error: "forbidden" };
  }

  await disconnectSlackIntegration(projectId);

  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    action: AuditActions.slackDisconnected,
    ...actorFromSession(session.user),
    resourceType: "slack",
    resourceId: projectId,
    resourceLabel: project.name,
  });

  revalidatePath("/dashboard/settings/account");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reconnectSlackAction(raw: unknown) {
  const parsed = reconnectSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "invalid input" };

  const { projectId } = await requireActiveProject();
  if (parsed.data.projectId !== projectId) {
    return { ok: false as const, error: "forbidden" };
  }

  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false as const, error: "project not found" };

  let session;
  try {
    ({ session } = await requireOrgOwner(project.orgId));
  } catch {
    return { ok: false as const, error: "forbidden" };
  }

  if (!hasSlackOAuth()) {
    return { ok: false as const, error: "Slack OAuth is not configured." };
  }

  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    action: AuditActions.slackReconnectStarted,
    ...actorFromSession(session.user),
    resourceType: "slack",
    resourceId: projectId,
    resourceLabel: project.name,
  });

  const origin = parsed.data.origin.replace(/\/$/, "");
  const state = signSlackOAuthState(projectId, origin);
  redirect(slackOAuthAuthorizeUrl({ origin, state }));
}

export async function deleteAccountAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { session, projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  const members = await listOrgMembers(project.orgId);
  const owners = members.filter((m) => m.role === "owner");
  const isOwner = owners.some((m) => m.userId === session.user.id);

  if (isOwner && owners.length === 1 && members.length > 1) {
    return {
      ok: false,
      error: "Transfer ownership or remove other members before deleting your account.",
    };
  }

  if (session.user.isSuperadmin && (await countUsers()) <= 1) {
    return { ok: false, error: "Cannot delete the last user in the system." };
  }

  await db.delete(kasieUsers).where(eq(kasieUsers.id, session.user.id));
  await signOut({ redirectTo: "/sign-in" });
  return { ok: true };
}
