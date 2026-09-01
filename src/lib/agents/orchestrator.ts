import { buildRunSystemPrompt } from "@/lib/agents/system-prompt";
import {
  generateAgentResponse,
  generateAgentResponseWithTools,
} from "@/lib/ai/provider";
import type { ToolSet } from "ai";
import type { RunContext, RunInput, RunResult } from "@/lib/ai/types";
import { getProjectWithConfig } from "@/lib/db/queries/projects";
import {
  createPendingAction,
  getPendingAction,
  getRunById,
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

  async executeRun(ctx: RunContext, input: RunInput): Promise<RunResult> {
    const rl = runLog(ctx);
    rl.info("run started", { messageLength: input.message.length });
    await updateRunStatus(ctx.runId, "running");

    await db.insert(kasieInteractions).values({
      runId: ctx.runId,
      role: "user",
      content: input.message,
      metadata: input.metadata ?? {},
    });

    const memories = await retrieveMemories(ctx.projectId, input.message);
    rl.debug("memories retrieved", { count: memories.length });
    const memoryContext = formatMemoriesForPrompt(memories);

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
          ? `\nAvailable integrations: ${descriptors.map((t) => t.name).join(", ")}`
          : "";

      if (Object.keys(aiTools).length > 0) {
        rl.debug("generating response with tools");
        const result = await generateAgentResponseWithTools({
          tier: ctx.config.modelTier,
          system: buildRunSystemPrompt(ctx),
          prompt: `${input.message}${memoryContext}${toolHint}`,
          tools: aiTools as ToolSet,
          runId: ctx.runId,
        });
        text = result.text;
        usage = result.usage;
        rl.info("llm response with tools", {
          responseLength: text.length,
          ...usage,
          toolCallCount: result.toolCalls.length,
        });

        if (result.toolCalls.length > 0) {
          const write = result.toolCalls[0];
          rl.info("write tool blocked for approval", {
            toolName: write.toolName,
          });
          const action = await createPendingAction({
            runId: ctx.runId,
            toolName: write.toolName,
            payload: write.args,
          });
          await updateRunStatus(ctx.runId, "awaiting_approval", { text });
          await recordUsageSafe(ctx, usage);
          return { text, usage, pendingActionId: action.id };
        }
      } else {
        rl.debug("generating response without tools");
        const result = await generateAgentResponse({
          tier: ctx.config.modelTier,
          system: buildRunSystemPrompt(ctx),
          prompt: `${input.message}${memoryContext}${toolHint}`,
          runId: ctx.runId,
        });
        text = result.text;
        usage = result.usage;
        rl.info("llm response", { responseLength: text.length, ...usage });
      }
    } finally {
      await gateway.close();
    }

    if (input.message.toLowerCase().includes("remember")) {
      rl.info("memory store pending approval");
      const action = await createPendingAction({
        runId: ctx.runId,
        toolName: "store_memory",
        payload: { message: input.message },
      });
      await updateRunStatus(ctx.runId, "awaiting_approval", { text });
      await recordUsageSafe(ctx, usage);
      return { text, usage, pendingActionId: action.id };
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

    const { text, usage } = await generateAgentResponse({
      tier: ctx.config.modelTier,
      system: buildRunSystemPrompt(ctx),
      prompt: `Approved tool ${action.toolName}. Result: ${JSON.stringify(execResult.result ?? execResult)}. Continue helping with: ${input.message}`,
      runId,
    });
    rl.info("resume response generated", { responseLength: text.length, ...usage });

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
    },
  };
}
