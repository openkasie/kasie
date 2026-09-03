import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { RunContext } from "@/lib/ai/types";
import { getLanguageModel } from "@/lib/ai/provider";
import { classifyTool } from "@/lib/mcp/classify-tool";
import type { DiscoverySession, McpToolDescriptor } from "@/lib/mcp/gateway";
import {
  buildExplorationMission,
  buildExplorationSystem,
  DISCOVERY_CONTINUE_PROMPT,
  DISCOVERY_EXPLORATION_ROUNDS,
  DISCOVERY_STEPS_PER_ROUND,
} from "@/lib/integrations/discovery-strategies";
import { createLogger } from "@/lib/log";

const log = createLogger("discovery-agent");

export type ExplorationProbe = {
  toolName: string;
  ok: boolean;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

const RELOAD_AFTER_TOOL =
  /^(retrieve_options|CONFIGURE_COMPONENT|configure_component|begin_configuration_)/i;
const RELOAD_AFTER_SUFFIX = /-(options|props|prop|id-options)$/i;

function shouldReloadAfter(toolName: string): boolean {
  return RELOAD_AFTER_TOOL.test(toolName) || RELOAD_AFTER_SUFFIX.test(toolName);
}

function wrapIntegrationTools(
  rawTools: Record<string, unknown>,
  probes: ExplorationProbe[],
  onReload: () => Promise<{ toolCount: number; toolNames: string[] }>,
  dl: ReturnType<typeof log.child>,
): ToolSet {
  const wrapped: ToolSet = {};

  for (const [name, entry] of Object.entries(rawTools)) {
    if (!entry || typeof entry !== "object" || !("execute" in entry)) {
      wrapped[name] = entry as ToolSet[string];
      continue;
    }

    const original = (entry as { execute: (args: unknown, opts: unknown) => Promise<unknown> })
      .execute;

    wrapped[name] = {
      ...entry,
      execute: async (args: unknown, opts: unknown) => {
        const argRecord = (args ?? {}) as Record<string, unknown>;

        if (classifyTool(name) === "write") {
          dl.debug("write tool blocked during exploration", { toolName: name });
          probes.push({
            toolName: name,
            ok: false,
            args: argRecord,
            error: "blocked: write tool during exploration",
          });
          return { blocked: true, reason: "write tools disabled during account exploration" };
        }

        dl.debug("exploration tool call", { toolName: name });
        try {
          const result = await original(args, opts);
          probes.push({ toolName: name, ok: true, args: argRecord, result });

          if (shouldReloadAfter(name)) {
            const reloaded = await onReload();
            dl.info("tools reloaded after exploration step", {
              toolName: name,
              toolCount: reloaded.toolCount,
            });
          }

          return result;
        } catch (err) {
          const error = err instanceof Error ? err.message : "tool execution failed";
          probes.push({ toolName: name, ok: false, args: argRecord, error });
          return { error };
        }
      },
    } as ToolSet[string];
  }

  return wrapped;
}

export async function runAccountExploration(input: {
  ctx: RunContext;
  session: DiscoverySession;
  integration: { nickname: string; appSlug: string };
  initialTools: McpToolDescriptor[];
}): Promise<{
  probes: ExplorationProbe[];
  agentNotes: string;
  usage: { inputTokens: number; outputTokens: number };
}> {
  const dl = log.child({
    runId: input.ctx.runId,
    projectId: input.ctx.projectId,
    appSlug: input.integration.appSlug,
  });

  const probes: ExplorationProbe[] = [];
  const notes: string[] = [];
  let totalUsage = { inputTokens: 0, outputTokens: 0 };
  let catalogTools = input.initialTools;

  const reloadHandler = async () => {
    catalogTools = await input.session.reloadTools();
    return { toolCount: catalogTools.length, toolNames: catalogTools.map((t) => t.name) };
  };

  let messages: { role: "user" | "assistant"; content: string }[] = [
    {
      role: "user",
      content: buildExplorationMission(input.integration, catalogTools),
    },
  ];

  for (let round = 0; round < DISCOVERY_EXPLORATION_ROUNDS; round++) {
    catalogTools = await input.session.listTools();
    const rawTools = await input.session.getAiTools();
    const integrationTools = wrapIntegrationTools(rawTools, probes, reloadHandler, dl);

    const tools: ToolSet = {
      ...integrationTools,
      reload_integration_tools: tool({
        description:
          "Reload the integration tool catalog after configuration steps. Call after CONFIGURE_COMPONENT or *-options tools.",
        inputSchema: z.object({}),
        execute: async () => reloadHandler(),
      }),
    };

    dl.info("exploration round started", {
      round,
      toolCount: catalogTools.length,
    });

    const result = await generateText({
      model: await getLanguageModel(input.ctx.config.modelTier),
      system: buildExplorationSystem(input.integration, catalogTools),
      messages,
      tools,
      stopWhen: stepCountIs(DISCOVERY_STEPS_PER_ROUND),
    });

    totalUsage = {
      inputTokens: totalUsage.inputTokens + (result.usage?.inputTokens ?? 0),
      outputTokens: totalUsage.outputTokens + (result.usage?.outputTokens ?? 0),
    };

    if (result.text.trim()) notes.push(result.text.trim());
    if (result.text.trim()) {
      messages.push({ role: "assistant", content: result.text.trim() });
    }

    dl.info("exploration round finished", {
      round,
      stepCount: result.steps?.length ?? 0,
      probeCount: probes.length,
      finished: result.text.includes("EXPLORATION_COMPLETE"),
    });

    if (result.text.includes("EXPLORATION_COMPLETE")) break;

    const toolCallsThisRound = result.steps?.flatMap((s) => s.toolCalls ?? []) ?? [];
    if (toolCallsThisRound.length === 0) break;

    messages.push({ role: "user", content: DISCOVERY_CONTINUE_PROMPT });
  }

  return {
    probes,
    agentNotes: notes.join("\n\n"),
    usage: totalUsage,
  };
}
