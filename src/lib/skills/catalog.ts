export type SkillPreset = {
  id: string;
  label: string;
  description: string;
};

export const SKILL_PRESETS: SkillPreset[] = [
  {
    id: "release-notes",
    label: "Release notes",
    description: "Draft weekly release summaries",
  },
  {
    id: "incident-triage",
    label: "Incident triage",
    description: "Summarize alerts and suggest next steps",
  },
  {
    id: "standup-summary",
    label: "Standup summary",
    description: "Compile recent activity into a daily standup update",
  },
  {
    id: "status-updates",
    label: "Status updates",
    description: "Draft stakeholder and client progress reports",
  },
  {
    id: "meeting-prep",
    label: "Meeting prep",
    description: "Brief on context before meetings from recent threads",
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Turn decisions and threads into docs or runbooks",
  },
  {
    id: "code-review",
    label: "Code review",
    description: "Summarize PRs, flag risks, and suggest review focus",
  },
  {
    id: "research-brief",
    label: "Research brief",
    description: "Synthesize information on a topic from connected tools",
  },
  {
    id: "weekly-digest",
    label: "Weekly digest",
    description: "Summarize team activity across channels and tools",
  },
];

export function isCatalogSkill(id: string): boolean {
  return SKILL_PRESETS.some((s) => s.id === id);
}

export function sanitizeEnabledSkillIds(ids: string[]): string[] {
  return ids.filter((id) => isCatalogSkill(id));
}
