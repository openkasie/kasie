import type { RunListItemRun } from "@/design-system";
import type { listRunsForProject } from "@/lib/db/queries/projects";
import { NOTHING_TO_REPORT } from "@/lib/proactive/constants";

type RunRecord = Awaited<ReturnType<typeof listRunsForProject>>[number];

/**
 * Initiative and system runs store an internal machine prompt as their input,
 * so surface the agent's own response (or a friendly label) instead.
 */
function displayMessage(run: RunRecord): string {
  if (run.source === "initiative" || run.source === "system") {
    const text = (run.output as { text?: string } | null)?.text?.trim();
    if (text === NOTHING_TO_REPORT) return "Checked in, nothing to report";
    if (text) return text;
    return run.source === "initiative" ? "Checking in with an update" : "Background work";
  }

  const message = (run.input as { message?: string }).message?.trim();
  if (message) return message;
  return run.source === "schedule" ? "Scheduled task" : "Untitled task";
}

export function toRunListItem(run: RunRecord): RunListItemRun {
  return {
    id: run.id,
    status: run.status,
    source: run.source,
    message: displayMessage(run),
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    output: run.output,
  };
}
