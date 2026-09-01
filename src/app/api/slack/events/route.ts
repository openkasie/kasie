import { after, NextResponse } from "next/server";
import { z } from "zod";
import { enqueueAndProcess } from "@/lib/agents/process-run";
import { orgWithinBudget } from "@/lib/usage/budget";
import {
  getProjectByTeamId,
  getSlackBotToken,
  upsertThread,
} from "@/lib/db/queries/projects";
import { createRun, getRunByIdempotencyKey } from "@/lib/db/queries/runs";
import { mcpGateway } from "@/lib/mcp/gateway";
import { generateSlackCopy } from "@/lib/slack/copy";
import {
  addSlackReaction,
  completeSlackMessage,
  deleteSlackMessage,
  getSlackUserName,
  postSlackApprovalRequest,
  postSlackMessage,
  removeSlackReaction,
  signalSlackProcessing,
  SLACK_PROCESSING_REACTION,
  updateSlackMessage,
} from "@/lib/slack/message";
import { parseReactSentinel } from "@/lib/slack/react-sentinel";

const TOOL_PROGRESS_DEBOUNCE_MS = 2000;

const slackEventSchema = z.object({
  type: z.string(),
  challenge: z.string().optional(),
  team_id: z.string().optional(),
  event: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      channel: z.string().optional(),
      channel_type: z.string().optional(),
      thread_ts: z.string().optional(),
      ts: z.string().optional(),
      bot_id: z.string().optional(),
      user: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const body = await request.text();
  const payload = slackEventSchema.parse(JSON.parse(body));

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const teamId = payload.team_id;
  const event = payload.event;
  const isUserMessage =
    event &&
    (event.type === "message" || event.type === "app_mention") &&
    !event.bot_id &&
    event.text;
  if (!teamId || !isUserMessage) {
    return NextResponse.json({ ok: true });
  }

  const project = await getProjectByTeamId(teamId);
  if (!project) {
    return NextResponse.json({ ok: true, warning: "unknown tenant" });
  }

  const botToken = await getSlackBotToken(project.id);

  if (!(await orgWithinBudget(project.orgId))) {
    if (event.channel && botToken) {
      const budgetMessage = await generateSlackCopy({
        projectId: project.id,
        kind: "budget_exceeded",
        context: { userMessage: event.text },
      });
      await postSlackMessage(
        event.channel,
        budgetMessage,
        botToken,
        event.thread_ts ?? event.ts,
      );
    }
    return NextResponse.json({ ok: true, warning: "budget_exceeded" });
  }

  const threadKey = `${event.channel}:${event.thread_ts ?? event.ts}`;
  const thread = await upsertThread(project.id, threadKey, { channel: event.channel });

  const idempotencyKey = `slack:${event.ts}`;
  const existing = await getRunByIdempotencyKey(project.id, idempotencyKey);
  if (existing) {
    return NextResponse.json({ ok: true, runId: existing.id });
  }

  const userName =
    event.user && botToken ? await getSlackUserName(event.user, botToken) : null;

  const runInput = {
    message: event.text,
    channel: event.channel,
    channelType: event.channel_type,
    slackUserId: event.user,
    ...(userName ? { userName } : {}),
  };

  const run = await createRun({
    threadId: thread.id,
    projectId: project.id,
    input: runInput,
    idempotencyKey,
    source: "slack",
  });

  const channel = event.channel;
  const messageTs = event.ts;
  const threadTs = event.thread_ts ?? event.ts;
  const canAck = Boolean(channel && messageTs && botToken);

  if (canAck) {
    await signalSlackProcessing({
      channel: channel!,
      messageTs: messageTs!,
      botToken: botToken!,
    });
  }

  const jobPayload = {
    runId: run.id,
    projectId: project.id,
    threadId: thread.id,
    payload: runInput as Record<string, unknown>,
  };

  after(async () => {
    if (!canAck) return;

    try {
      // Verbal ack only when integrations are connected and the run may take a
      // while; for quick answers the eyes reaction is acknowledgment enough.
      let ackTs: string | undefined;
      const hasTools =
        (await mcpGateway.discoverTools(project.id).catch(() => [])).length > 0;
      if (hasTools) {
        const ackText = await generateSlackCopy({
          projectId: project.id,
          kind: "ack",
          context: { userMessage: event.text },
        });
        ackTs = await postSlackMessage(channel!, ackText, botToken!, threadTs!);
      }

      // Live tool progress: edit the ack in place as tools start, at most
      // one edit per debounce window. Best-effort; never blocks the run.
      let lastProgressAt = 0;
      const onToolStart = (toolName: string) => {
        if (!ackTs || toolName === "remember") return;
        const nowMs = Date.now();
        if (nowMs - lastProgressAt < TOOL_PROGRESS_DEBOUNCE_MS) return;
        lastProgressAt = nowMs;
        void updateSlackMessage(
          channel!,
          ackTs,
          `Checking \`${toolName}\`...`,
          botToken!,
        ).catch(() => {});
      };

      await enqueueAndProcess(jobPayload, { onToolStart });
      const completed = await import("@/lib/db/queries/runs").then((m) =>
        m.getRunById(project.id, run.id),
      );
      const output = completed?.output as {
        text?: string;
        pendingActions?: { id: string; toolName: string }[];
      } | null;
      let text = output?.text?.trim();

      // Reaction-only reply: acknowledge on the user's message instead of
      // posting text into the thread.
      const reaction = text ? parseReactSentinel(text) : null;
      if (reaction) {
        await addSlackReaction(channel!, messageTs!, reaction, botToken!);
        if (ackTs) await deleteSlackMessage(channel!, ackTs, botToken!);
        await removeSlackReaction(
          channel!,
          messageTs!,
          SLACK_PROCESSING_REACTION,
          botToken!,
        );
        return;
      }

      if (!text) {
        text = await generateSlackCopy({
          projectId: project.id,
          kind: "empty_response",
          context: { userMessage: event.text },
        });
      }
      await completeSlackMessage({
        channel: channel!,
        messageTs: messageTs!,
        threadTs: threadTs!,
        botToken: botToken!,
        text,
        ackTs,
      });

      if (completed?.status === "awaiting_approval" && output?.pendingActions?.length) {
        for (const pending of output.pendingActions) {
          await postSlackApprovalRequest({
            channel: channel!,
            botToken: botToken!,
            toolName: pending.toolName,
            actionId: pending.id,
            runId: run.id,
            threadTs: threadTs!,
          });
        }
      }
    } catch (err) {
      console.error("slack after() run failed", err);
      try {
        const errorText = await generateSlackCopy({
          projectId: project.id,
          kind: "processing_failed",
          context: { userMessage: event.text },
        });
        await postSlackMessage(channel!, errorText, botToken!, threadTs!);
      } catch (copyErr) {
        console.error("slack error copy failed", copyErr);
      }
      await removeSlackReaction(
        channel!,
        messageTs!,
        SLACK_PROCESSING_REACTION,
        botToken!,
      );
    }
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
