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
import { generateSlackCopy } from "@/lib/slack/copy";
import {
  completeSlackMessage,
  postSlackMessage,
  removeSlackReaction,
  signalSlackProcessing,
  SLACK_PROCESSING_REACTION,
} from "@/lib/slack/message";

const slackEventSchema = z.object({
  type: z.string(),
  challenge: z.string().optional(),
  team_id: z.string().optional(),
  event: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      channel: z.string().optional(),
      thread_ts: z.string().optional(),
      ts: z.string().optional(),
      bot_id: z.string().optional(),
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

  const run = await createRun({
    threadId: thread.id,
    projectId: project.id,
    input: { message: event.text, channel: event.channel },
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
    payload: { message: event.text, channel: event.channel },
  };

  after(async () => {
    if (!canAck) return;

    try {
      const ackText = await generateSlackCopy({
        projectId: project.id,
        kind: "ack",
        context: { userMessage: event.text },
      });
      await postSlackMessage(channel!, ackText, botToken!, threadTs!);

      await enqueueAndProcess(jobPayload);
      const completed = await import("@/lib/db/queries/runs").then((m) =>
        m.getRunById(project.id, run.id),
      );
      let text = (completed?.output as { text?: string } | null)?.text?.trim();
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
      });
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
