import { generateText } from "ai";
import type { RunContext, RunResult } from "@/lib/ai/types";
import { getLanguageModel } from "@/lib/ai/provider";
import { hasAiProvider } from "@/lib/env";
import { getIntegrationById, updateDiscoveryStatus } from "@/lib/db/queries/integrations";
import { getSlackBotToken } from "@/lib/db/queries/projects";
import { storeMemoryTriple, clearIntegrationDiscoveryMemories } from "@/lib/embeddings/memory";
import { createDiscoverySession } from "@/lib/mcp/gateway";
import { runAccountExploration } from "@/lib/integrations/discovery-agent";
import {
  buildDiscoveryMemories,
  DISCOVERY_OWNED_RELATIONS,
} from "@/lib/integrations/discovery-memory";
import {
  accountFactsOnly,
  distillAgentNotes,
  extractProbeInsights,
  formatHumanFacts,
  summarizeProbesForPrompt,
} from "@/lib/integrations/probe-insights";
import {
  buildFallbackFollowUp,
  buildFallbackSummary,
} from "@/lib/integrations/discovery-followup";
import {
  formatDiscoveryFindingsForCopy,
  isLowQualityDiscoveryCopy,
  sanitizeDiscoverySlackText,
} from "@/lib/integrations/discovery-copy";
import {
  sendDiscoveryResults,
  sendDiscoveryStarted,
} from "@/lib/slack/integration-discovery";
import { generateSlackCopy } from "@/lib/slack/copy";
import { db } from "@/lib/db/client";
import { kasieInteractions } from "@/lib/db/schema";
import { updateRunStatus } from "@/lib/db/queries/runs";
import { createLogger } from "@/lib/log";

const log = createLogger("discovery");

type DiscoveryProbeResult = {
  toolName: string;
  ok: boolean;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

async function buildDiscoverySlackCopy(input: {
  projectId: string;
  nickname: string;
  appSlug: string;
  humanFacts: string[];
  agentNotes: string;
  factCount: number;
  memoryPreview: { entity: string; relation: string; target: string }[];
}): Promise<{ summary: string; followUp: string }> {
  const findingsBlock = formatDiscoveryFindingsForCopy(input.humanFacts, input.memoryPreview);
  const notes = distillAgentNotes(input.agentNotes);
  const copyContext = {
    integrationNickname: input.nickname,
    appSlug: input.appSlug,
    discoveryFindings: findingsBlock || undefined,
    discoveryNotes: notes || undefined,
  };

  const fallbackFollowUp = buildFallbackFollowUp({
    appSlug: input.appSlug,
    nickname: input.nickname,
    probeInsights: input.memoryPreview.filter((m) => m.relation !== "connected_via"),
  });

  try {
    const [summary, followUpRaw] = await Promise.all([
      generateSlackCopy({
        projectId: input.projectId,
        kind: "discovery_summary",
        context: copyContext,
      }),
      generateSlackCopy({
        projectId: input.projectId,
        kind: "discovery_report",
        context: copyContext,
      }),
    ]);

    if (!summary.startsWith("[stub]") && !followUpRaw.startsWith("[stub]")) {
      const followUp = sanitizeDiscoverySlackText(followUpRaw);
      if (!isLowQualityDiscoveryCopy(followUp)) {
        return { summary, followUp };
      }
    }
  } catch {
    // fall through
  }

  return {
    summary: buildFallbackSummary({ nickname: input.nickname, factCount: input.factCount }),
    followUp: fallbackFollowUp,
  };
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

  let probes: DiscoveryProbeResult[] = [];
  let agentNotes = "";
  let dmThread: { channel: string; threadTs: string } | null = null;
  const session = await createDiscoverySession({
    projectId: ctx.projectId,
    integrationId,
  });

  if (!session) {
    throw new Error("failed to open discovery session");
  }

  try {
    if (integration.createdByUserId) {
      const botToken = await getSlackBotToken(ctx.projectId);
      if (botToken) {
        dmThread = await sendDiscoveryStarted({
          projectId: ctx.projectId,
          userId: integration.createdByUserId,
          botToken,
          nickname: integration.nickname,
          appSlug: integration.appSlug,
        });
      }
    }

    const appTools = await session.listTools();
    dl.info("tool catalog loaded", { toolCount: appTools.length });

    if (hasAiProvider() && appTools.length > 0) {
      const exploration = await runAccountExploration({
        ctx,
        session,
        integration: {
          nickname: integration.nickname,
          appSlug: integration.appSlug,
        },
        initialTools: appTools,
      });
      probes = exploration.probes;
      agentNotes = exploration.agentNotes;
      dl.info("account exploration finished", {
        probeCount: probes.length,
        meaningfulProbes: summarizeProbesForPrompt(probes).length,
      });
    }

    const probeInsights = extractProbeInsights(integration.nickname, probes);
    const accountFacts = accountFactsOnly(probeInsights);
    const humanFacts = formatHumanFacts(accountFacts);
    dl.info("probe insights extracted", {
      insightCount: probeInsights.length,
      accountFactCount: accountFacts.length,
      humanFactCount: humanFacts.length,
    });
    if (probes.some((p) => p.ok && p.result != null) && accountFacts.length === 0) {
      dl.warn("probes returned data but no account facts extracted — using narrative fallback");
    }

    let dmSummary = buildFallbackSummary({
      nickname: integration.nickname,
      factCount: accountFacts.length,
    });
    const memoryPreview = buildDiscoveryMemories({
      entity: integration.nickname,
      appSlug: integration.appSlug,
      facts: accountFacts,
      humanFacts,
    });
    let followUp = buildFallbackFollowUp({
      appSlug: integration.appSlug,
      nickname: integration.nickname,
      probeInsights: memoryPreview.filter((m) => m.relation !== "connected_via"),
    });

    if (hasAiProvider()) {
      const copy = await buildDiscoverySlackCopy({
        projectId: ctx.projectId,
        nickname: integration.nickname,
        appSlug: integration.appSlug,
        humanFacts,
        agentNotes,
        factCount: accountFacts.length,
        memoryPreview,
      });
      dmSummary = copy.summary;
      followUp = copy.followUp;
    }

    const narrativeForMemory = [
      distillAgentNotes(agentNotes, 400),
      dmSummary,
      followUp.slice(0, 400),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);

    const triples = buildDiscoveryMemories({
      entity: integration.nickname,
      appSlug: integration.appSlug,
      facts: accountFacts,
      humanFacts,
      narrativeSummary: narrativeForMemory || undefined,
    });
    dl.info("discovery memories consolidated", { memoryCount: triples.length });

    const seen = new Set<string>();
    const dedupedTriples = triples.filter((triple) => {
      const key = `${triple.entity}|${triple.relation}|${triple.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await clearIntegrationDiscoveryMemories(
      ctx.projectId,
      integration.nickname,
      DISCOVERY_OWNED_RELATIONS,
    );

    for (const triple of dedupedTriples) {
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
          projectId: ctx.projectId,
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
      metadata: {
        probes,
        triples: dedupedTriples.length,
        accountFacts: accountFacts.length,
        strategy: "prompt-driven",
        exploration: distillAgentNotes(agentNotes, 2000),
      },
    });

    await updateRunStatus(ctx.runId, "completed", { text: dmSummary });
    dl.info("discovery completed", {
      probeCount: probes.length,
      tripleCount: dedupedTriples.length,
      accountFactCount: accountFacts.length,
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
    await session.close();
  }
}
