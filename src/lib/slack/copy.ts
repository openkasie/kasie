import { buildAgentSystemPrompt } from "@/lib/agents/system-prompt";
import { generateAgentResponse } from "@/lib/ai/provider";
import type { ModelTier } from "@/lib/ai/types";
import {
  getProjectWithConfig,
  listIntegrations,
} from "@/lib/db/queries/projects";
import { mcpGateway } from "@/lib/mcp/gateway";
import {
  buildSlackCopyPrompt,
  COPY_LIMITS,
  type SlackCopyContext,
  type SlackCopyKind,
} from "./copy-prompt";

export type { SlackCopyContext, SlackCopyKind } from "./copy-prompt";
const SLACK_WRITER_SUFFIX = [
  "Write for Slack mrkdwn only.",
  "Bold: *single asterisks* (never **).",
  "Bullets: start lines with • (never - or * list markers).",
  "Inline commands: `backticks`.",
  "Output only the message body — no quotes, labels, or preamble.",
].join(" ");

function copyTier(configTier: ModelTier): ModelTier {
  return configTier === "ultra" ? "smart" : configTier;
}

export async function generateSlackCopy(input: {
  projectId: string;
  kind: SlackCopyKind;
  context?: SlackCopyContext;
}): Promise<string> {
  const ctx = input.context ?? {};
  const data = await getProjectWithConfig(input.projectId);
  if (!data?.config) {
    throw new Error("project config not found");
  }

  const integrations = await listIntegrations(input.projectId);
  const tools = await mcpGateway.discoverTools(input.projectId);
  const integrationHint =
    integrations.length > 0
      ? `Connected integrations: ${integrations.map((i) => i.appSlug).join(", ")}.`
      : "No integrations connected yet — mention the dashboard if relevant.";
  const toolHint =
    tools.length > 0
      ? `Available tools: ${tools.map((t) => t.name).join(", ")}.`
      : "";

  const system = [
    buildAgentSystemPrompt({
      agentName: data.project.agentName,
      systemPrompt: data.project.systemPrompt,
      personalityTone: data.config.personalityTone,
      workspaceInstructions: data.config.workspaceInstructions,
      enabledSkillIds: data.config.enabledSkillIds ?? [],
    }),
    SLACK_WRITER_SUFFIX,
    integrationHint,
    toolHint,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateAgentResponse({
    tier: copyTier(data.config.modelTier),
    system,
    prompt: buildSlackCopyPrompt(input.kind, ctx),
    maxOutputTokens: COPY_LIMITS[input.kind],
  });

  return text.trim();
}
