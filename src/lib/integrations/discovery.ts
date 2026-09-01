import { generateText } from "ai";
import { z } from "zod";
import type { RunContext, RunResult } from "@/lib/ai/types";
import { getLanguageModel } from "@/lib/ai/provider";
import { hasAiProvider } from "@/lib/env";
import { getIntegrationById, updateDiscoveryStatus } from "@/lib/db/queries/integrations";
import { getSlackBotToken } from "@/lib/db/queries/projects";
import { storeMemoryTriple } from "@/lib/embeddings/memory";
import { McpGateway } from "@/lib/mcp/gateway";
import { probeStepsForApp } from "@/lib/integrations/probes";
import { buildFallbackFollowUp } from "@/lib/integrations/discovery-followup";
import {
  sendDiscoveryResults,
  sendDiscoveryStarted,
} from "@/lib/slack/integration-discovery";
import { db } from "@/lib/db/client";
import { kasieInteractions } from "@/lib/db/schema";
import { updateRunStatus } from "@/lib/db/queries/runs";
import { createLogger } from "@/lib/log";

const log = createLogger("discovery");

const DiscoveryOutputSchema = z.object({
  dmSummary: z.string().min(1),
  followUp: z.string().min(1),
  triples: z
    .array(
      z.object({
        entity: z.string().min(1),
        relation: z.string().min(1),
        target: z.string().min(1),
      }),
    )
    .max(20),
});

type DiscoveryProbeResult = {
  toolName: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

function buildDiscoveryPrompt(input: {
  appSlug: string;
  nickname: string;
  probes: DiscoveryProbeResult[];
}) {
  return [
    `Integration connected: ${input.nickname} (${input.appSlug}).`,
    "Probe results:",
    JSON.stringify(input.probes, null, 2),
    "",
    "Return JSON only with keys: dmSummary, followUp, triples.",
    "dmSummary: Slack mrkdwn, under 600 chars — what was connected and headline findings (2-3 bullets max).",
    "followUp: REQUIRED Slack mrkdwn thread reply with sections:",
    "  *What I indexed* — bullets of graph memories saved",
    "  *What I can do now* — concrete actions Kasie can take via connected tools",
    "  *Try asking me* — 2 example prompts the operator can send",
    "triples: array of entity/relation/target for knowledge graph (5-12 items from probe data).",
  ].join("\n");
}

export async function runIntegrationDiscovery(
  ctx: RunContext,
  integrationId: string,
): Promise<RunResult> {
  const dl = log.child({
    runId: ctx.runId,
    projectId: ctx.projectId,
    integrationId,
  });

  const integration = await getIntegrationById(ctx.projectId, integrationId);
  if (!integration || integration.status !== "connected") {
    throw new Error("integration not found or not connected");
  }

  dl.info("discovery started", { appSlug: integration.appSlug });
  await updateDiscoveryStatus(integrationId, "running");
  await updateRunStatus(ctx.runId, "running");

  await db.insert(kasieInteractions).values({
    runId: ctx.runId,
    role: "system",
    content: `Starting discovery for ${integration.appSlug}`,
    metadata: { integrationId },
  });

  const gateway = new McpGateway();
  const probes: DiscoveryProbeResult[] = [];
  let dmThread: { channel: string; threadTs: string } | null = null;

  try {
    if (integration.createdByUserId) {
      const botToken = await getSlackBotToken(ctx.projectId);
      if (botToken) {
        dmThread = await sendDiscoveryStarted({
          userId: integration.createdByUserId,
          botToken,
          nickname: integration.nickname,
          appSlug: integration.appSlug,
        });
      }
    }

    const descriptors = await gateway.discoverTools(
      ctx.projectId,
      integration.createdByUserId ?? undefined,
    );
    const appTools = descriptors.filter((t) => t.appSlug === integration.appSlug);
    const toolNames = appTools.map((t) => t.name);
    const steps = probeStepsForApp(integration.appSlug, toolNames);
    dl.info("probe plan built", { stepCount: steps.length, toolCount: toolNames.length });

    for (const step of steps) {
      dl.debug("probe step started", { toolName: step.toolName });
      const exec = await gateway.executeTool({
        projectId: ctx.projectId,
        userId: integration.createdByUserId ?? undefined,
        toolName: step.toolName,
        args: step.args ?? {},
      });
      probes.push({
        toolName: step.toolName,
        ok: exec.ok,
        result: exec.result,
        error: exec.ok ? undefined : String((exec.result as { error?: string })?.error ?? "failed"),
      });
      dl.info("probe step finished", { toolName: step.toolName, ok: exec.ok });
    }

    let dmSummary = `Connected *${integration.nickname}* (${integration.appSlug}). Discovery is complete — ask me to use this integration in Slack or the dashboard.`;
    const triples: { entity: string; relation: string; target: string }[] = [
      {
        entity: integration.nickname,
        relation: "connected_via",
        target: integration.appSlug,
      },
    ];
    let followUp = "";

    if (hasAiProvider() && probes.length > 0) {
      const { text } = await generateText({
        model: await getLanguageModel(ctx.config.modelTier),
        system:
          "You analyze integration probe results for an AI coworker. Output valid JSON only.",
        prompt: buildDiscoveryPrompt({
          appSlug: integration.appSlug,
          nickname: integration.nickname,
          probes,
        }),
      });

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = DiscoveryOutputSchema.parse(
          JSON.parse(jsonMatch?.[0] ?? text),
        );
        dmSummary = parsed.dmSummary;
        followUp = parsed.followUp;
        triples.push(...parsed.triples);
      } catch (err) {
        dl.error("discovery parse failed", undefined, err);
      }
    }

    if (!followUp) {
      followUp = buildFallbackFollowUp({
        appSlug: integration.appSlug,
        nickname: integration.nickname,
        tools: appTools,
        triples,
      });
    }

    for (const triple of triples) {
      await storeMemoryTriple({
        projectId: ctx.projectId,
        entity: triple.entity,
        relation: triple.relation,
        target: triple.target,
      });
    }

    if (integration.createdByUserId && dmThread) {
      const botToken = await getSlackBotToken(ctx.projectId);
      if (botToken) {
        await sendDiscoveryResults({
          channel: dmThread.channel,
          threadTs: dmThread.threadTs,
          botToken,
          summary: dmSummary,
          followUp,
        });
      }
    } else if (integration.createdByUserId) {
      const botToken = await getSlackBotToken(ctx.projectId);
      if (botToken) {
        const thread = await sendDiscoveryStarted({
          userId: integration.createdByUserId,
          botToken,
          nickname: integration.nickname,
          appSlug: integration.appSlug,
        });
        if (thread) {
          await sendDiscoveryResults({
            channel: thread.channel,
            threadTs: thread.threadTs,
            botToken,
            summary: dmSummary,
            followUp,
          });
        }
      }
    }

    await updateDiscoveryStatus(integrationId, "completed", {
      discoverySummary: dmSummary,
      discoveredAt: new Date(),
    });

    await db.insert(kasieInteractions).values({
      runId: ctx.runId,
      role: "assistant",
      content: dmSummary,
      metadata: { probes, triples: triples.length },
    });

    await updateRunStatus(ctx.runId, "completed", { text: dmSummary });
    dl.info("discovery completed", {
      probeCount: probes.length,
      tripleCount: triples.length,
      summaryLength: dmSummary.length,
    });
    return { text: dmSummary };
  } catch (err) {
    dl.error("discovery failed", undefined, err);
    await updateDiscoveryStatus(integrationId, "failed");
    await updateRunStatus(ctx.runId, "failed", {
      error: err instanceof Error ? err.message : "discovery failed",
    });
    throw err;
  } finally {
    await gateway.close();
  }
}
