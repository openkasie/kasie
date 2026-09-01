import { NextResponse } from "next/server";
import { z } from "zod";
import { orchestrator } from "@/lib/agents/orchestrator";
import { getProjectByTeamId } from "@/lib/db/queries/projects";
import { getPendingAction, resolvePendingAction } from "@/lib/db/queries/runs";

const interactionSchema = z.object({
  type: z.string(),
  team: z.object({ id: z.string() }).optional(),
  actions: z
    .array(
      z.object({
        action_id: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  user: z.object({ id: z.string(), name: z.string().optional() }).optional(),
});

export async function POST(request: Request) {
  const body = await request.text();
  const raw = new URLSearchParams(body).get("payload");
  if (!raw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  const payload = interactionSchema.parse(JSON.parse(raw));
  const action = payload.actions?.[0];
  if (!action) return NextResponse.json({ ok: true });

  if (!payload.team?.id) {
    return NextResponse.json({ error: "missing team" }, { status: 400 });
  }

  const project = await getProjectByTeamId(payload.team.id);
  if (!project) {
    return NextResponse.json({ ok: true, warning: "unknown tenant" });
  }

  const [verb, actionId, runId] = action.value.split(":");
  const pending = await getPendingAction(project.id, actionId);
  if (!pending) return NextResponse.json({ ok: true });

  const resolvedBy = payload.user?.name ?? payload.user?.id ?? "slack-user";

  if (verb === "approve") {
    await resolvePendingAction(actionId, "approved", resolvedBy);
    if (runId && runId === pending.runId) {
      await orchestrator.resumeAfterApproval(project.id, runId, actionId);
    }
  } else {
    await resolvePendingAction(actionId, "rejected", resolvedBy);
  }

  return NextResponse.json({ ok: true });
}
