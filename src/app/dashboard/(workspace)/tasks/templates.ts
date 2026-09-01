import { SKILL_PRESETS } from "@/lib/skills/catalog";

export type TaskTemplate = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  cron: string;
};

/** Prompt and default schedule per skill preset that works as a recurring task. */
const TEMPLATE_DEFAULTS: Record<string, { prompt: string; cron: string }> = {
  "standup-summary": {
    prompt:
      "Compile a standup update from yesterday's activity: what was worked on, what is in progress, and anything blocked. Keep it scannable.",
    cron: "0 9 * * 1-5",
  },
  "weekly-digest": {
    prompt:
      "Summarize this week's team activity across channels and connected tools: shipped work, open discussions, and loose ends worth attention next week.",
    cron: "0 16 * * 5",
  },
  "release-notes": {
    prompt:
      "Draft release notes for the past week: group changes by area, write a non-technical summary first, and list notable fixes.",
    cron: "0 9 * * 0",
  },
  "meeting-prep": {
    prompt:
      "Brief me on context for today's meetings from recent threads: relevant decisions, open questions, and what each attendee likely needs.",
    cron: "0 8 * * 1-5",
  },
  "status-updates": {
    prompt:
      "Draft a stakeholder progress report: current status, what changed since the last update, risks, and next milestones.",
    cron: "0 9 * * 1",
  },
  "incident-triage": {
    prompt:
      "Review recent alerts and incidents from connected tools. Summarize anything unresolved and suggest next steps for each.",
    cron: "0 */6 * * *",
  },
};

export const TASK_TEMPLATES: TaskTemplate[] = SKILL_PRESETS.filter(
  (s) => s.id in TEMPLATE_DEFAULTS,
).map((s) => ({
  id: s.id,
  label: s.label,
  description: s.description,
  ...TEMPLATE_DEFAULTS[s.id],
}));
