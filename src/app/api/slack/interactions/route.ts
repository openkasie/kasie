import { after, NextResponse } from "next/server";
import { z } from "zod";
import { orchestrator } from "@/lib/agents/orchestrator";
import {
  getProjectByTeamId,
  getSlackBotToken,
  getThreadById,
} from "@/lib/db/queries/projects";
import {
  getPendingAction,
  getRunById,
  resolvePendingAction,
} from "@/lib/db/queries/runs";
import { postSlackMessage, updateSlackMessage } from "@/lib/slack/message";

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
  channel: z.object({ id: z.string() }).optional(),
  message: z.object({ ts: z.string() }).optional(),
});

/** Resolve the Slack channel + thread the pending action's run belongs to. */
async function resolveRunThread(projectId: string, runId: string) {
  const run = await getRunById(projectId, runId);
  if (!run) return null;
  const thread = await getThreadById(projectId, run.threadId);
  if (!thread) return null;
  const [channel, threadTs] = thread.externalThreadKey.split(":");
  return channel && threadTs ? { channel, threadTs } : null;
}

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
  if (!pending || pending.status !== "pending") {
    return NextResponse.json({ ok: true });
  }

  const resolvedBy = payload.user?.name ?? payload.user?.id ?? "slack-user";
  const approved = verb === "approve";
  await resolvePendingAction(actionId, approved ? "approved" : "rejected", resolvedBy);

  const approvalMessage =
    payload.channel?.id && payload.message?.ts
      ? { channel: payload.channel.id, ts: payload.message.ts }
      : null;

  // Ack Slack within its 3s window; the resume itself can take a while.
  after(async () => {
    try {
      const botToken = await getSlackBotToken(project.id);
      const location = await resolveRunThread(project.id, pending.runId);

      // Retire the buttons so the message reflects the decision.
      if (botToken && approvalMessage) {
        await updateSlackMessage(
          approvalMessage.channel,
          approvalMessage.ts,
          approved
            ? `Approved by ${resolvedBy}: \`${pending.toolName}\``
            : `Rejected by ${resolvedBy}: \`${pending.toolName}\``,
          botToken,
          { blocks: [] },
        );
      }

      if (approved && runId === pending.runId) {
        const result = await orchestrator.resumeAfterApproval(
          project.id,
          runId,
          actionId,
        );
        if (botToken && location && result.text) {
          await postSlackMessage(
            location.channel,
            result.text,
            botToken,
            location.threadTs,
          );
        }
      } else if (!approved && botToken && location) {
        await postSlackMessage(
          location.channel,
          `Got it, I won't run \`${pending.toolName}\`.`,
          botToken,
          location.threadTs,
        );
      }
    } catch (err) {
      console.error("slack interaction follow-up failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}
