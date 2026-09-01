import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "../client";
import {
  kasiePendingActions,
  kasieProjects,
  kasieRuns,
  type RunSource,
} from "../schema";

export async function getRunById(projectId: string, runId: string) {
  const [run] = await db
    .select()
    .from(kasieRuns)
    .where(and(eq(kasieRuns.projectId, projectId), eq(kasieRuns.id, runId)))
    .limit(1);
  return run ?? null;
}

// Platform-wide lookup reserved for the API-key-gated polling route.
// All tenant-scoped paths must use getRunById(projectId, runId).
export async function getRunByIdGlobal(runId: string) {
  const [run] = await db
    .select()
    .from(kasieRuns)
    .where(eq(kasieRuns.id, runId))
    .limit(1);
  return run ?? null;
}

export async function getRunOrgId(runId: string) {
  const [row] = await db
    .select({ orgId: kasieProjects.orgId })
    .from(kasieRuns)
    .innerJoin(kasieProjects, eq(kasieRuns.projectId, kasieProjects.id))
    .where(eq(kasieRuns.id, runId))
    .limit(1);
  return row?.orgId ?? null;
}

export async function getRunByIdempotencyKey(
  projectId: string,
  idempotencyKey: string,
) {
  const [run] = await db
    .select()
    .from(kasieRuns)
    .where(
      and(
        eq(kasieRuns.projectId, projectId),
        eq(kasieRuns.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function createRun(input: {
  threadId: string;
  projectId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  source?: RunSource;
  initiatedByUserId?: string;
  initiatedByApiKeyId?: string;
}) {
  const [run] = await db
    .insert(kasieRuns)
    .values({
      threadId: input.threadId,
      projectId: input.projectId,
      input: input.input,
      idempotencyKey: input.idempotencyKey,
      source: input.source,
      initiatedByUserId: input.initiatedByUserId,
      initiatedByApiKeyId: input.initiatedByApiKeyId,
      status: "queued",
    })
    .returning();
  return run;
}

export async function updateRunStatus(
  runId: string,
  status: (typeof kasieRuns.$inferSelect)["status"],
  output?: Record<string, unknown>,
) {
  const now = new Date();
  const patch: Partial<(typeof kasieRuns.$inferInsert)> = { status };
  if (output) patch.output = output;
  if (status === "running") patch.startedAt = now;
  if (status === "completed" || status === "failed" || status === "cancelled") {
    patch.completedAt = now;
  }

  const [run] = await db
    .update(kasieRuns)
    .set(patch)
    .where(eq(kasieRuns.id, runId))
    .returning();
  return run;
}

export async function getPendingAction(projectId: string, actionId: string) {
  const [action] = await db
    .select(getTableColumns(kasiePendingActions))
    .from(kasiePendingActions)
    .innerJoin(kasieRuns, eq(kasiePendingActions.runId, kasieRuns.id))
    .where(
      and(
        eq(kasiePendingActions.id, actionId),
        eq(kasieRuns.projectId, projectId),
      ),
    )
    .limit(1);
  return action ?? null;
}

export async function resolvePendingAction(
  actionId: string,
  status: "approved" | "rejected",
  resolvedBy: string,
) {
  const [action] = await db
    .update(kasiePendingActions)
    .set({
      status,
      resolvedBy,
      resolvedAt: new Date(),
    })
    .where(eq(kasiePendingActions.id, actionId))
    .returning();
  return action;
}

export async function createPendingAction(input: {
  runId: string;
  toolName: string;
  payload: Record<string, unknown>;
  riskLevel?: string;
}) {
  const [action] = await db
    .insert(kasiePendingActions)
    .values({
      runId: input.runId,
      toolName: input.toolName,
      payload: input.payload,
      riskLevel: input.riskLevel ?? "write",
    })
    .returning();
  return action;
}
