import { capHistoryByBudget } from "@/lib/agents/history";
import { buildRememberTool } from "@/lib/agents/memory-tool";
import { buildRunSystemPrompt } from "@/lib/agents/system-prompt";
import {
  generateAgentResponse,
  generateAgentResponseWithTools,
} from "@/lib/ai/provider";
import type { ToolSet } from "ai";
import type {
  AgentMessage,
  PendingActionRef,
  RunContext,
  RunHooks,
  RunInput,
  RunResult,
} from "@/lib/ai/types";
import { getProjectWithConfig } from "@/lib/db/queries/projects";
import {
  createPendingAction,
  getPendingAction,
  getRunById,
  getThreadInteractionHistory,
  updateRunStatus,
} from "@/lib/db/queries/runs";
import { recordRunUsage } from "@/lib/usage/meter";
import { db } from "@/lib/db/client";
import { kasieInteractions } from "@/lib/db/schema";
import {
  formatMemoriesForPrompt,
  retrieveMemories,
  storeMemoryTriple,
} from "@/lib/embeddings/memory";
import { McpGateway } from "@/lib/mcp/gateway";
import { runIntegrationDiscovery } from "@/lib/integrations/discovery";
import { createLogger } from "@/lib/log";

const log = createLogger("orchestrator");

function runLog(ctx: RunContext) {
  return log.child({
    runId: ctx.runId,
    projectId: ctx.projectId,
    orgId: ctx.orgId,
    threadId: ctx.threadId,
    modelTier: ctx.config.modelTier,
  });
}

type InteractionRow = {
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

// Prefix user turns with the speaker's name so multi-person threads and
// person-keyed memory stay attributable.
function attributed(content: string, name?: string): string {
  return name ? `${name}: ${content}` : content;
}

function toAgentMessages(history: InteractionRow[]): AgentMessage[] {
  return history
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({
      role: h.role as "user" | "assistant",
      content:
        h.role === "user"
          ? attributed(
              h.content,
              typeof h.metadata?.userName === "string" ? h.metadata.userName : undefined,
            )
          : h.content,
    }));
}

async function recordUsageSafe(
  ctx: RunContext,
  usage: { inputTokens: number; outputTokens: number } | undefined,
): Promise<void> {
  if (!ctx.orgId || !usage) return;
  try {
    await recordRunUsage({
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      runId: ctx.runId,
      tier: ctx.config.modelTier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    runLog(ctx).debug("usage recorded", usage);
  } catch (err) {
    runLog(ctx).error("usage meter failed", usage, err);
  }
}

class KasieOrchestrator {
  async runIntegrationDiscovery(ctx: RunContext, integrationId: string) {
    return runIntegrationDiscovery(ctx, integrationId);
  }

  async executeRun(
    ctx: RunContext,
    input: RunInput,
    hooks?: RunHooks,
  ): Promise<RunResult> {
    const rl = runLog(ctx);
    rl.info("run started", { messageLength: input.message.length });
    await updateRunStatus(ctx.runId, "running");

    const history = await getThreadInteractionHistory(ctx.threadId);
    rl.debug("thread history loaded", { count: history.length });

    await db.insert(kasieInteractions).values({
      runId: ctx.runId,
      role: "user",
      content: input.message,
      metadata: input.metadata ?? {},
    });

    const speakerName =
      typeof input.metadata?.userName === "string" ? input.metadata.userName : undefined;

    const memories = await retrieveMemories(ctx.projectId, input.message, {
      speakerName,
    });
    rl.debug("memories retrieved", { count: memories.length });
    const memoryContext = formatMemoriesForPrompt(memories);

    const messages: AgentMessage[] = [
      ...capHistoryByBudget(toAgentMessages(history)),
      { role: "user", content: attributed(input.message, speakerName) },
    ];

    const userId =
      typeof input.metadata?.userId === "string" ? input.metadata.userId : undefined;

    const gateway = new McpGateway();
    let text: string;
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    try {
      const descriptors = await gateway.discoverTools(ctx.projectId, userId);
      const aiTools = await gateway.getAiTools(ctx.projectId, userId);
      rl.info("tools discovered", {
        descriptorCount: descriptors.length,
        aiToolCount: Object.keys(aiTools).length,
      });
      const toolHint =
        descriptors.length > 0
          ? `\n\nAvailable integrations: ${descriptors.map((t) => t.name).join(", ")}`
          : "";
      const memoryHint =
        "\n\nMemory: use the `remember` tool to store durable facts (ownership, preferences, decisions, deadlines). Check the team memory above before re-asking or repeating a suggestion.";
      const channelType =
        typeof input.metadata?.channelType === "string"
          ? input.metadata.channelType
          : undefined;
      const settingHint =
        channelType === "im" || channelType === "mpim"
          ? "\n\nSetting: direct message. One-on-one register; looser and more personal, never broadcast-formal."
          : channelType
            ? "\n\nSetting: shared channel. Others are reading; keep replies tight, skimmable, and worth the channel's attention."
            : "";
      const system = `${buildRunSystemPrompt(ctx)}${memoryContext}${toolHint}${memoryHint}${settingHint}`;

      const tools: ToolSet = {
        ...(aiTools as ToolSet),
        remember: buildRememberTool(ctx.projectId),
      };

      const result = await generateAgentResponseWithTools({
        tier: ctx.config.modelTier,
        system,
        messages,
        tools,
        runId: ctx.runId,
        onToolStart: hooks?.onToolStart,
      });
      text = result.text;
      usage = result.usage;
      rl.info("llm response with tools", {
        responseLength: text.length,
        ...usage,
        toolCallCount: result.toolCalls.length,
      });

      if (result.toolCalls.length > 0) {
        rl.info("write tools blocked for approval", {
          toolNames: result.toolCalls.map((t) => t.toolName),
        });
        const pendingActions: PendingActionRef[] = [];
        for (const write of result.toolCalls) {
          const action = await createPendingAction({
            runId: ctx.runId,
            toolName: write.toolName,
            payload: write.args,
          });
          pendingActions.push({ id: action.id, toolName: write.toolName });
        }
        await updateRunStatus(ctx.runId, "awaiting_approval", {
          text,
          pendingActions,
        });
        await recordUsageSafe(ctx, usage);
        return { text, usage, pendingActions };
      }
    } finally {
      await gateway.close();
    }

    await storeMemoryTriple({
      projectId: ctx.projectId,
      entity: "conversation",
      relation: "discussed",
      target: input.message.slice(0, 200),
    });
    rl.debug("conversation memory stored");

    await db.insert(kasieInteractions).values({
      runId: ctx.runId,
      role: "assistant",
      content: text,
      metadata: { usage },
    });

    await updateRunStatus(ctx.runId, "completed", { text, usage });
    await recordUsageSafe(ctx, usage);
    rl.info("run completed", { responseLength: text.length, ...usage });
    return { text, usage };
  }

  async cancelRun(runId: string): Promise<void> {
    log.info("run cancelled", { runId });
    await updateRunStatus(runId, "cancelled");
  }

  async resumeAfterApproval(
    projectId: string,
    runId: string,
    actionId: string,
  ): Promise<RunResult> {
    const run = await getRunById(projectId, runId);
    if (!run) throw new Error("run not found");

    const action = await getPendingAction(projectId, actionId);
    if (!action) throw new Error("action not found");

    const rl = log.child({ runId, projectId, actionId, toolName: action.toolName });
    rl.info("resuming after approval");

    const projectData = await getProjectWithConfig(run.projectId);
    if (!projectData?.config) throw new Error("project config not found");

    const ctx: RunContext = {
      projectId: run.projectId,
      orgId: projectData.project.orgId,
      threadId: run.threadId,
      runId: run.id,
      config: {
        modelTier: projectData.config.modelTier,
        personalityTone: projectData.config.personalityTone,
        workspaceInstructions: projectData.config.workspaceInstructions,
        systemPrompt: projectData.project.systemPrompt,
        agentName: projectData.project.agentName,
        enabledSkillIds: projectData.config.enabledSkillIds ?? [],
        timezone: projectData.config.timezone,
      },
    };

    const input = run.input as RunInput;
    await updateRunStatus(runId, "running");

    const gateway = new McpGateway();
    let execResult: { ok: boolean; result?: unknown } = { ok: false };

    try {
      execResult = await gateway.executeTool({
        projectId: ctx.projectId,
        toolName: action.toolName,
        args: action.payload as Record<string, unknown>,
        force: true,
      });
      rl.info("approved tool executed", { ok: execResult.ok });
    } finally {
      await gateway.close();
    }

    // Resume with the same conversational context as a normal run: thread
    // history (which includes this run's user message), the partial reply the
    // agent gave before pausing, and the tool result as the newest turn.
    const [history, memories] = await Promise.all([
      getThreadInteractionHistory(run.threadId),
      retrieveMemories(ctx.projectId, input.message),
    ]);
    const partialReply = (run.output as { text?: string } | null)?.text?.trim();
    const resultJson = JSON.stringify(execResult.result ?? execResult).slice(0, 4000);

    const messages: AgentMessage[] = [
      ...capHistoryByBudget(toAgentMessages(history)),
      ...(partialReply
        ? [{ role: "assistant" as const, content: partialReply }]
        : []),
      {
        role: "user",
        content: `[system] Your pending \`${action.toolName}\` action was approved and executed. Result: ${resultJson}\nReport the outcome in the conversation and finish helping with the original request.`,
      },
    ];

    const { text, usage } = await generateAgentResponse({
      tier: ctx.config.modelTier,
      system: `${buildRunSystemPrompt(ctx)}${formatMemoriesForPrompt(memories)}`,
      messages,
      runId,
    });
    rl.info("resume response generated", { responseLength: text.length, ...usage });

    await db.insert(kasieInteractions).values({
      runId,
      role: "assistant",
      content: text,
      metadata: { usage, resumedFromActionId: actionId },
    });

    await updateRunStatus(runId, "completed", { text, usage });
    await recordUsageSafe(ctx, usage);
    rl.info("run completed after approval");
    return { text, usage };
  }
}

export const orchestrator = new KasieOrchestrator();

export async function buildRunContext(
  projectId: string,
  threadId: string,
  runId: string,
): Promise<RunContext> {
  const data = await getProjectWithConfig(projectId);
  if (!data?.config) throw new Error("project not found");

  return {
    projectId,
    orgId: data.project.orgId,
    threadId,
    runId,
    config: {
      modelTier: data.config.modelTier,
      personalityTone: data.config.personalityTone,
      workspaceInstructions: data.config.workspaceInstructions,
      systemPrompt: data.project.systemPrompt,
      agentName: data.project.agentName,
      enabledSkillIds: data.config.enabledSkillIds ?? [],
      timezone: data.config.timezone,
    },
  };
}
