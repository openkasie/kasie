import { SKILL_PRESETS } from "@/lib/skills/catalog";
import type { RunContext } from "@/lib/ai/types";

export type AgentPromptConfig = {
  agentName: string;
  systemPrompt: string | null;
  personalityTone: string;
  workspaceInstructions: string | null;
  enabledSkillIds?: string[];
};

function buildSkillPromptSection(enabledSkillIds: string[]): string {
  const enabled = SKILL_PRESETS.filter((s) => enabledSkillIds.includes(s.id));
  if (enabled.length === 0) return "";
  const lines = enabled.map((s) => `- ${s.label}: ${s.description}`);
  return `\nEnabled skill presets:\n${lines.join("\n")}\nUse these capabilities when relevant.`;
}

export function buildAgentSystemPrompt(config: AgentPromptConfig): string {
  const parts = [
    `You are ${config.agentName}, an AI coworker.`,
    config.systemPrompt ?? "",
    `Tone: ${config.personalityTone}.`,
    config.workspaceInstructions ?? "",
    config.enabledSkillIds?.length
      ? buildSkillPromptSection(config.enabledSkillIds)
      : "",
  ].filter(Boolean);
  return parts.join("\n");
}

export function buildRunSystemPrompt(ctx: RunContext): string {
  return buildAgentSystemPrompt({
    ...ctx.config,
    enabledSkillIds: ctx.config.enabledSkillIds,
  });
}
