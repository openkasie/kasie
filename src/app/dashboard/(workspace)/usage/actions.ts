"use server";

import { revalidatePath } from "next/cache";
import { getOrgById, getOrgMembership } from "@/lib/db/queries/orgs";
import { getProjectById } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { setOrgMonthlyBudget } from "@/lib/usage/budget";
import { AuditActions, actorFromSession, recordAuditEvent } from "@/lib/audit";
import { BudgetActionSchema } from "./schemas";

export async function updateOrgBudget(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = BudgetActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid input" };

  const { session, projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  const membership = await getOrgMembership(session.user.id, project.orgId);
  if (membership?.role !== "owner" && !session.user.isSuperadmin) {
    return { ok: false, error: "forbidden" };
  }

  const org = await getOrgById(project.orgId);
  const cents =
    parsed.data.intent === "clear"
      ? null
      : Math.round(parsed.data.usd * 100);

  await setOrgMonthlyBudget(project.orgId, cents);

  await recordAuditEvent({
    orgId: project.orgId,
    projectId,
    action: AuditActions.budgetUpdated,
    ...actorFromSession(session.user),
    resourceType: "org",
    resourceId: project.orgId,
    resourceLabel: org?.name ?? "Organization",
    metadata: {
      previousBudgetCents: org?.monthlyBudgetCents ?? null,
      nextBudgetCents: cents,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/usage");
  return { ok: true };
}

export async function exportAuditCsv(
  raw: unknown,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const { session, projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return { ok: false, error: "project not found" };

  const membership = await getOrgMembership(session.user.id, project.orgId);
  if (membership?.role !== "owner" && !session.user.isSuperadmin) {
    return { ok: false, error: "forbidden" };
  }

  const range =
    typeof raw === "object" &&
    raw &&
    "range" in raw &&
    typeof raw.range === "string"
      ? raw.range
      : "30d";

  const { parseUsageRange, usageRangeSince } = await import("@/lib/usage/range");
  const { exportAuditEvents } = await import("@/lib/db/queries/usage");

  const events = await exportAuditEvents(project.orgId, {
    since: usageRangeSince(parseUsageRange(range)),
    includeOwnerOnly: true,
  });

  const header = "timestamp,category,action,actor,workspace,resource,cost_usd\n";
  const rows = events
    .map((event) => {
      const cost =
        event.costMicros != null ? (event.costMicros / 1_000_000).toFixed(6) : "";
      return [
        event.createdAt.toISOString(),
        event.category,
        event.action,
        `"${event.actorLabel.replaceAll('"', '""')}"`,
        `"${(event.projectName ?? "").replaceAll('"', '""')}"`,
        `"${(event.resourceLabel ?? "").replaceAll('"', '""')}"`,
        cost,
      ].join(",");
    })
    .join("\n");

  return { ok: true, csv: header + rows };
}
