// Relative .ts import keeps this module loadable by the node:test runner,
// which has no @/ alias resolution.
import { NOTHING_TO_REPORT } from "./constants.ts";

export type InitiativeLooseEnds = {
  pendingApprovals: { toolName: string; createdAt: Date }[];
  priorInitiatives: string[];
  silentSchedules: { title: string | null }[];
};

function formatAge(from: Date, now: Date): string {
  const hours = Math.max(Math.floor((now.getTime() - from.getTime()) / 3_600_000), 0);
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function buildLooseEndsSection(
  looseEnds: InitiativeLooseEnds,
  now: Date,
): string {
  const lines: string[] = [];

  for (const approval of looseEnds.pendingApprovals) {
    lines.push(
      `- Approval waiting ${formatAge(approval.createdAt, now)}: \`${approval.toolName}\` still needs a human decision. A nudge may be warranted.`,
    );
  }
  for (const schedule of looseEnds.silentSchedules) {
    lines.push(
      `- Schedule "${schedule.title ?? "untitled"}" has produced nothing on its last runs; consider suggesting it be tuned or paused.`,
    );
  }

  const sections: string[] = [];
  if (lines.length > 0) sections.push(["Loose ends:", ...lines].join("\n"));

  if (looseEnds.priorInitiatives.length > 0) {
    sections.push(
      [
        "Updates you already sent (do not repeat these):",
        ...looseEnds.priorInitiatives.map((t) => `- ${t.slice(0, 300)}`),
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}

export function buildInitiativePrompt(input: {
  now: Date;
  recentMessages: string[];
  integrationSlugs: string[];
  looseEnds?: InitiativeLooseEnds;
}): string {
  const recent =
    input.recentMessages.length > 0
      ? input.recentMessages.map((m) => `- ${m.slice(0, 300)}`).join("\n")
      : "- (none recorded)";
  const integrations =
    input.integrationSlugs.length > 0 ? input.integrationSlugs.join(", ") : "none";
  const looseEndsSection = input.looseEnds
    ? buildLooseEndsSection(input.looseEnds, input.now)
    : "";

  return [
    `It is ${input.now.toISOString()} and your operator has been away for a while. This is your own initiative: no one asked you a question. Review what you know and produce one short, high-signal Slack update that is genuinely useful to come back to.`,
    "",
    "Good outcomes, pick whichever fits best:",
    "- Concrete suggestions or next steps on open items from recent conversations",
    "- A follow-up you can prepare now (a draft, a checklist, a summary)",
    "- A brief digest of loose ends worth attention, with a recommendation each",
    "- If no requests are recorded yet, introduce yourself briefly and suggest two or three concrete tasks you could take on, grounded in the connected integrations",
    "",
    "Recent requests you handled:",
    recent,
    "",
    ...(looseEndsSection ? [looseEndsSection, ""] : []),
    `Connected integrations: ${integrations}`,
    "",
    "Rules:",
    "- Be specific and reference the actual work above; never write generic filler.",
    "- Do not repeat a suggestion you already made; check your memory first.",
    "- Store what you suggest to memory so future updates stay fresh.",
    `- If there is genuinely nothing valuable to add, reply with exactly ${NOTHING_TO_REPORT} and nothing else.`,
  ].join("\n");
}
