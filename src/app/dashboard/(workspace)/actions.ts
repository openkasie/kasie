"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { kasieProjectConfig, kasieProjects } from "@/lib/db/schema";
import { orchestrator } from "@/lib/agents/orchestrator";
import { AuditActions, actorFromSession, recordAuditEvent } from "@/lib/audit";
import { requireActiveProject } from "@/lib/auth/session";
import { getOrgMembership, listOrgMembers, removeOrgMember } from "@/lib/db/queries/orgs";
import { getProjectById } from "@/lib/db/queries/projects";
import { resolvePendingAction, getPendingAction } from "@/lib/db/queries/runs";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  updateSchedule,
} from "@/lib/db/queries/schedules";
import { isValidCron, nextAfter } from "@/lib/proactive/cron";
import { isCatalogSkill, sanitizeEnabledSkillIds } from "@/lib/skills/catalog";
import {
  ApprovalActionSchema,
  ConfigUpdateSchema,
  ScheduleDeleteSchema,
  ScheduleUpsertSchema,
  SkillToggleSchema,
  WorkspaceUpdateSchema,
} from "./schemas";

async function auditProjectAction(
  projectId: string,
  event: Omit<
    Parameters<typeof recordAuditEvent>[0],
    "orgId" | "projectId" | "actorUserId" | "actorType" | "actorLabel"
  > & { session: { user: { id: string; name?: string | null; email?: string | null } } },
) {
  const project = await getProjectById(projectId);
  if (!project?.orgId) return;
  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    ...actorFromSession(event.session.user),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    resourceLabel: event.resourceLabel,
    metadata: event.metadata,
    costMicros: event.costMicros,
  });
}

export async function updateProjectConfig(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = ConfigUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  await db
    .update(kasieProjectConfig)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(kasieProjectConfig.projectId, projectId));

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.configUpdated,
    resourceType: "project_config",
    resourceId: projectId,
    resourceLabel: "Agent preferences",
    metadata: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/preferences");
  return { ok: true };
}

export async function updateWorkspaceIdentity(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = WorkspaceUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  if (!parsed.data.name) {
    return { ok: false, error: "nothing to update" };
  }

  await db
    .update(kasieProjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(kasieProjects.id, projectId));

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.workspaceUpdated,
    resourceType: "project",
    resourceId: projectId,
    resourceLabel: parsed.data.name ?? "Workspace",
    metadata: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/workspace");
  return { ok: true };
}

export async function toggleSkill(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = SkillToggleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  if (!isCatalogSkill(parsed.data.skillId)) {
    return { ok: false, error: "unknown skill" };
  }

  const [config] = await db
    .select()
    .from(kasieProjectConfig)
    .where(eq(kasieProjectConfig.projectId, projectId))
    .limit(1);

  if (!config) return { ok: false, error: "config not found" };

  const ids = new Set(sanitizeEnabledSkillIds(config.enabledSkillIds ?? []));
  if (parsed.data.enabled) ids.add(parsed.data.skillId);
  else ids.delete(parsed.data.skillId);

  await db
    .update(kasieProjectConfig)
    .set({ enabledSkillIds: sanitizeEnabledSkillIds([...ids]), updatedAt: new Date() })
    .where(eq(kasieProjectConfig.projectId, projectId));

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.skillToggled,
    resourceType: "skill",
    resourceId: projectId,
    resourceLabel: parsed.data.skillId,
    metadata: { enabled: parsed.data.enabled },
  });

  revalidatePath("/dashboard/skills");
  return { ok: true };
}

export async function resolveApproval(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = ApprovalActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const action = await getPendingAction(projectId, parsed.data.actionId);
  if (!action) return { ok: false, error: "action not found" };

  const resolvedBy =
    session.user.email ?? session.user.name ?? session.user.id;
  await resolvePendingAction(parsed.data.actionId, parsed.data.decision, resolvedBy);

  if (parsed.data.decision === "approved") {
    await orchestrator.resumeAfterApproval(projectId, action.runId, action.id);
  }

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.approvalResolved,
    resourceType: "pending_action",
    resourceId: action.id,
    resourceLabel: action.toolName,
    metadata: { decision: parsed.data.decision, runId: action.runId },
  });

  revalidatePath("/dashboard/approvals");
  return { ok: true };
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export async function toggleSchedule(
  scheduleId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const schedule = await getSchedule(projectId, scheduleId);
  if (!schedule) return { ok: false, error: "task not found" };

  // Re-enabling starts from the next occurrence, never a long-past slot.
  const nextRunAt = enabled
    ? nextAfter(schedule.cron, new Date(), schedule.timezone)
    : null;
  await updateSchedule(projectId, scheduleId, { enabled, nextRunAt });

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.scheduleToggled,
    resourceType: "schedule",
    resourceId: scheduleId,
    resourceLabel: schedule.title,
    metadata: { enabled },
  });

  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function saveSchedule(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = ScheduleUpsertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const { scheduleId, channel, ...data } = parsed.data;
  if (!isValidCron(data.cron)) return { ok: false, error: "invalid schedule" };
  if (!isValidTimezone(data.timezone)) return { ok: false, error: "invalid timezone" };

  const nextRunAt = data.enabled
    ? nextAfter(data.cron, new Date(), data.timezone)
    : null;

  if (scheduleId) {
    const updated = await updateSchedule(projectId, scheduleId, {
      ...data,
      channel: channel ?? null,
      nextRunAt,
    });
    if (!updated) return { ok: false, error: "task not found" };
  } else {
    await createSchedule({
      projectId,
      ...data,
      channel: channel ?? null,
      nextRunAt,
    });
  }

  await auditProjectAction(projectId, {
    session,
    action: scheduleId ? AuditActions.scheduleUpdated : AuditActions.scheduleCreated,
    resourceType: "schedule",
    resourceId: scheduleId ?? projectId,
    resourceLabel: data.title,
    metadata: { cron: data.cron, timezone: data.timezone, enabled: data.enabled },
  });

  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function removeSchedule(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();

  const parsed = ScheduleDeleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const deleted = await deleteSchedule(projectId, parsed.data.scheduleId);
  if (!deleted) return { ok: false, error: "task not found" };

  await auditProjectAction(projectId, {
    session,
    action: AuditActions.scheduleDeleted,
    resourceType: "schedule",
    resourceId: deleted.id,
    resourceLabel: deleted.title,
  });

  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function removeTeamMember(
  orgId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireActiveProject();

  const membership = await getOrgMembership(session.user.id, orgId);
  if (!membership || membership.role !== "owner") {
    return { ok: false, error: "only owners can remove members" };
  }

  if (userId === session.user.id) {
    return { ok: false, error: "cannot remove yourself" };
  }

  const removed = (await listOrgMembers(orgId)).find((m) => m.userId === userId);

  await removeOrgMember(orgId, userId);

  await recordAuditEvent({
    orgId,
    action: AuditActions.memberRemoved,
    ...actorFromSession(session.user),
    resourceType: "org_member",
    resourceId: userId,
    resourceLabel: removed?.name ?? removed?.email ?? userId,
    metadata: { email: removed?.email ?? null },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}
