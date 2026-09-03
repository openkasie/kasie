"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  completeIntegration,
  disconnectIntegration,
  getIntegrationById,
  updateIntegration,
} from "@/lib/db/queries/integrations";
import { requireActiveProject } from "@/lib/auth/session";
import { AuditActions, actorFromSession, recordAuditEvent } from "@/lib/audit";
import { getProjectById } from "@/lib/db/queries/projects";
import { enqueueIntegrationDiscovery } from "@/lib/integrations/enqueue-discovery";
import { discoverToolsForIntegration } from "@/lib/mcp/gateway";
import { hasPipedream } from "@/lib/env";

const CompleteSchema = z.object({
  integrationId: z.string().uuid(),
  accountId: z.string().min(1),
});
const UpdateSchema = z.object({
  integrationId: z.string().uuid(),
  nickname: z.string().min(1).max(120).optional(),
  visibility: z.enum(["workspace", "private"]).optional(),
  enabled: z.boolean().optional(),
  toolPolicies: z
    .record(z.enum(["auto", "approval", "disabled"]))
    .optional(),
});

function revalidateIntegrationPaths(appSlug: string) {
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/dashboard/integrations/${appSlug}`);
}

export async function completeIntegrationAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();
  const parsed = CompleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const row = await completeIntegration({
    projectId,
    integrationId: parsed.data.integrationId,
    accountId: parsed.data.accountId,
  });

  if (!row) return { ok: false, error: "integration not found" };

  const project = await getProjectById(projectId);
  if (project?.orgId) {
    await recordAuditEvent({
      orgId: project.orgId,
      projectId,
      action: AuditActions.integrationConnected,
      ...actorFromSession(session.user),
      resourceType: "integration",
      resourceId: row.id,
      resourceLabel: `${row.appSlug} (${row.nickname})`,
      metadata: { accountId: parsed.data.accountId },
    });
  }

  after(() => enqueueIntegrationDiscovery(projectId, row.id));
  revalidateIntegrationPaths(row.appSlug);
  return { ok: true };
}

export async function disconnectIntegrationAction(
  integrationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();
  const row = await getIntegrationById(projectId, integrationId);
  if (!row) return { ok: false, error: "integration not found" };

  await disconnectIntegration(projectId, integrationId);

  const project = await getProjectById(projectId);
  if (project?.orgId) {
    await recordAuditEvent({
      orgId: project.orgId,
      projectId,
      action: AuditActions.integrationDisconnected,
      ...actorFromSession(session.user),
      resourceType: "integration",
      resourceId: row.id,
      resourceLabel: `${row.appSlug} (${row.nickname})`,
    });
  }

  revalidateIntegrationPaths(row.appSlug);
  return { ok: true };
}

export async function updateIntegrationAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const row = await updateIntegration(projectId, parsed.data.integrationId, {
    nickname: parsed.data.nickname,
    visibility: parsed.data.visibility,
    enabled: parsed.data.enabled,
    toolPolicies: parsed.data.toolPolicies,
  });

  if (!row) return { ok: false, error: "integration not found" };

  const project = await getProjectById(projectId);
  if (project?.orgId) {
    await recordAuditEvent({
      orgId: project.orgId,
      projectId,
      action: AuditActions.integrationUpdated,
      ...actorFromSession(session.user),
      resourceType: "integration",
      resourceId: row.id,
      resourceLabel: `${row.appSlug} (${row.nickname})`,
      metadata: {
        nickname: parsed.data.nickname,
        visibility: parsed.data.visibility,
        enabled: parsed.data.enabled,
        toolPolicies: parsed.data.toolPolicies,
      },
    });
  }

  revalidateIntegrationPaths(row.appSlug);
  revalidatePath(`/dashboard/integrations/${row.appSlug}/${row.id}`);
  return { ok: true };
}

export async function getIntegrationToolsAction(
  integrationId: string,
): Promise<
  | { ok: true; tools: Awaited<ReturnType<typeof discoverToolsForIntegration>> }
  | { ok: false; error: string }
> {
  const { projectId } = await requireActiveProject();
  if (!hasPipedream()) return { ok: false, error: "pipedream not configured" };

  const row = await getIntegrationById(projectId, integrationId);
  if (!row || row.status !== "connected") {
    return { ok: false, error: "integration not found" };
  }

  try {
    const tools = await discoverToolsForIntegration({ projectId, integrationId });
    return { ok: true, tools };
  } catch {
    return { ok: false, error: "failed to load tools" };
  }
}

export async function rerunDiscoveryAction(
  integrationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { projectId } = await requireActiveProject();
  const row = await getIntegrationById(projectId, integrationId);
  if (!row || row.status !== "connected") {
    return { ok: false, error: "integration not found" };
  }

  after(() => enqueueIntegrationDiscovery(projectId, integrationId, { force: true }));
  revalidateIntegrationPaths(row.appSlug);
  revalidatePath(`/dashboard/integrations/${row.appSlug}/${row.id}`);
  return { ok: true };
}
