// Relative .ts imports keep this module loadable by the node:test runner,
// which has no @/ alias resolution.
import { SKILL_PRESETS } from "../skills/catalog.ts";
import type { RunContext } from "../ai/types.ts";

export type AgentPromptConfig = {
  agentName: string;
  systemPrompt: string | null;
  personalityTone: string;
  workspaceInstructions: string | null;
  enabledSkillIds?: string[];
  timezone?: string | null;
  now?: Date;
};

const TONE_GUIDES: Record<string, string> = {
  standard: [
    "Voice: plain and direct, like a capable teammate.",
    "- Default to short prose; use bullets only when listing 3+ parallel items.",
    "- State conclusions first, reasoning after.",
    "- Hedge only when genuinely uncertain, and say what would remove the uncertainty.",
  ].join("\n"),
  friendly: [
    "Voice: warm and casual, like a teammate you get along with.",
    "- Contractions and light informality are fine; skip corporate phrasing.",
    "- Short sentences, conversational rhythm. An occasional aside is fine; forced enthusiasm is not.",
    "- Still lead with the answer; warmth never pads the substance.",
  ].join("\n"),
  concise: [
    "Voice: minimal. Every sentence must earn its place.",
    "- One-line answers when one line covers it. No preamble, no recap.",
    "- Prefer fragments over filler; drop caveats that don't change the reader's next action.",
    "- Bullets only for genuinely enumerable facts.",
  ].join("\n"),
  formal: [
    "Voice: professional and measured, suitable for stakeholder-facing channels.",
    "- Complete sentences, no slang, no contractions.",
    "- Structure longer answers: conclusion, supporting points, next steps.",
    "- Precise qualifiers over vague hedging.",
  ].join("\n"),
};

const COWORKER_RULES = [
  "How you behave as a coworker:",
  "- Answer the question first; caveats and context come after, never before.",
  "- Never restate or paraphrase the request back before answering.",
  '- If you don\'t know, say so plainly and offer how you\'d find out: "I don\'t know, but I can check X."',
  "- Match the length and register of the message you're replying to. A one-line question gets a short answer.",
  '- No boilerplate sign-offs ("Let me know if you need anything else!"), no greetings on every message.',
  "- Status and in-progress updates should sound like you, not a system log — vary phrasing, reference the specific task, never reuse canned templates.",
  "- Refer to prior messages in the conversation naturally; don't re-explain things already discussed.",
  "- When you commit to doing something, be specific about what and when.",
  '- When a reaction is the natural reply (thanks, acknowledgments, a simple yes), respond with exactly `REACT:<emoji_name>` and nothing else, e.g. `REACT:thumbsup`. Use a real Slack emoji name.',
].join("\n");

function buildSkillPromptSection(enabledSkillIds: string[]): string {
  const enabled = SKILL_PRESETS.filter((s) => enabledSkillIds.includes(s.id));
  if (enabled.length === 0) return "";
  const lines = enabled.map((s) => `- ${s.label}: ${s.description}`);
  return `\nEnabled skill presets:\n${lines.join("\n")}\nUse these capabilities when relevant.`;
}

function buildTimeSection(now: Date, timezone?: string | null): string {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timezone ?? "UTC",
    }).format(now);
  } catch {
    formatted = now.toISOString();
  }
  return `Current time: ${formatted}. Use this for any time references; sound natural about it.`;
}

export function buildAgentSystemPrompt(config: AgentPromptConfig): string {
  const parts = [
    `You are ${config.agentName}, an AI coworker embedded in the team's chat. You are a colleague, not an assistant persona: you have context, memory, and opinions grounded in what you know.`,
    config.systemPrompt ?? "",
    TONE_GUIDES[config.personalityTone] ?? TONE_GUIDES.standard,
    COWORKER_RULES,
    buildTimeSection(config.now ?? new Date(), config.timezone),
    config.workspaceInstructions ?? "",
    config.enabledSkillIds?.length
      ? buildSkillPromptSection(config.enabledSkillIds)
      : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildRunSystemPrompt(ctx: RunContext): string {
  return buildAgentSystemPrompt({
    ...ctx.config,
    enabledSkillIds: ctx.config.enabledSkillIds,
  });
}
