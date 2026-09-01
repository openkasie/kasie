import { generateText, stepCountIs, type ToolSet } from "ai";
import { getLanguageModel as getCompatLanguageModel } from "@/lib/ai/compat";
import { hasAiProvider } from "@/lib/env";
import { createLogger } from "@/lib/log";
import { resolveModelTier } from "./model-tiers";
import type { AgentMessage, ModelTier } from "./types";

const log = createLogger("ai-provider");

async function resolveModel(tier: ModelTier) {
  return resolveModelTier(tier);
}

export async function getLanguageModel(tier: ModelTier) {
  const { model } = await resolveModel(tier);
  return getCompatLanguageModel(model);
}

/** Either a single-shot prompt or a full conversation history. */
type PromptInput = { prompt: string; messages?: never } | { prompt?: never; messages: AgentMessage[] };

function toMessages(input: PromptInput): AgentMessage[] {
  return input.messages ?? [{ role: "user", content: input.prompt }];
}

function lastUserContent(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function totalLength(messages: AgentMessage[]): number {
  return messages.reduce((sum, m) => sum + m.content.length, 0);
}

export async function generateAgentResponse(input: {
  tier: ModelTier;
  system: string;
  maxOutputTokens?: number;
  runId?: string;
} & PromptInput) {
  const ll = input.runId ? log.child({ runId: input.runId, tier: input.tier }) : log.child({ tier: input.tier });
  const messages = toMessages(input);

  if (!hasAiProvider()) {
    ll.warn("stub response (no AI provider configured)");
    return {
      text: `[stub] ${lastUserContent(messages).slice(0, 200)}`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const { maxOutputTokens: tierMax, model } = await resolveModel(input.tier);
  ll.debug("llm request", { model, promptLength: totalLength(messages), messageCount: messages.length });
  const started = Date.now();
  const result = await generateText({
    model: await getLanguageModel(input.tier),
    system: input.system,
    messages,
    maxOutputTokens: input.maxOutputTokens ?? tierMax,
  });
  ll.info("llm response", {
    model,
    durationMs: Date.now() - started,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    responseLength: result.text.length,
  });

  return {
    text: result.text,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    },
  };
}

export async function generateAgentResponseWithTools(input: {
  tier: ModelTier;
  system: string;
  tools?: ToolSet;
  maxOutputTokens?: number;
  runId?: string;
  onToolStart?: (toolName: string) => void;
} & PromptInput) {
  const ll = input.runId ? log.child({ runId: input.runId, tier: input.tier }) : log.child({ tier: input.tier });
  const messages = toMessages(input);

  if (!hasAiProvider()) {
    ll.warn("stub response with tools (no AI provider configured)");
    return {
      text: `[stub] ${lastUserContent(messages).slice(0, 200)}`,
      usage: { inputTokens: 0, outputTokens: 0 },
      toolCalls: [] as { toolName: string; args: Record<string, unknown> }[],
    };
  }

  const { maxOutputTokens: tierMax, model } = await resolveModel(input.tier);
  const toolCount = input.tools ? Object.keys(input.tools).length : 0;
  ll.debug("llm request with tools", { model, promptLength: totalLength(messages), messageCount: messages.length, toolCount });
  const started = Date.now();
  const pendingWrites: { toolName: string; args: Record<string, unknown> }[] = [];

  const wrappedTools: ToolSet | undefined = input.tools
    ? Object.fromEntries(
      Object.entries(input.tools).map(([name, tool]) => {
        if (!tool || typeof tool !== "object" || !("execute" in tool)) {
          return [name, tool];
        }

        const original = (tool as { execute: (args: unknown, opts: unknown) => Promise<unknown> })
          .execute;

        return [
          name,
          {
            ...tool,
            execute: async (args: unknown, opts: unknown) => {
              try {
                input.onToolStart?.(name);
              } catch {
                // Progress hooks are best-effort; never fail the run.
              }
              const { classifyTool } = await import("@/lib/mcp/classify-tool");
              if (classifyTool(name) === "write") {
                ll.info("write tool intercepted", { toolName: name });
                pendingWrites.push({
                  toolName: name,
                  args: (args ?? {}) as Record<string, unknown>,
                });
                return { blocked: true, reason: "requires approval" };
              }
              ll.debug("read tool executing", { toolName: name });
              return original(args, opts);
            },
          },
        ];
      }),
    )
    : undefined;

  const result = await generateText({
    model: await getLanguageModel(input.tier),
    system: input.system,
    messages,
    tools: wrappedTools,
    stopWhen: stepCountIs(5),
    maxOutputTokens: input.maxOutputTokens ?? tierMax,
  });

  ll.info("llm response with tools", {
    model,
    durationMs: Date.now() - started,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    responseLength: result.text.length,
    pendingWriteCount: pendingWrites.length,
    stepCount: result.steps?.length ?? 0,
  });

  return {
    text: result.text,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    },
    toolCalls: pendingWrites,
  };
}
