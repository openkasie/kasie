import { enqueueAndProcess } from "@/lib/agents/process-run";
import {
  getInitiativeGateStats,
  listConnectedIntegrationSlugs,
  listProactiveCandidateProjects,
  listRecentUserMessages,
} from "@/lib/db/queries/proactive";
import { createRun, getRunByIdempotencyKey } from "@/lib/db/queries/runs";
import { upsertThread } from "@/lib/db/queries/projects";
import { createLogger } from "@/lib/log";
import { getQueue } from "@/lib/queue";
import { NOTHING_TO_REPORT } from "./deliver";
import { evaluateInitiativeGate, INITIATIVE_MIN_SPACING_MS } from "./gates";
import type { TickOptions } from "./scheduler";

const log = createLogger("proactive:initiative");

function buildInitiativePrompt(input: {
  now: Date;
  recentMessages: string[];
  integrationSlugs: string[];
}): string {
  const recent =
    input.recentMessages.length > 0
      ? input.recentMessages.map((m) => `- ${m.slice(0, 300)}`).join("\n")
      : "- (none recorded)";
  const integrations =
    input.integrationSlugs.length > 0 ? input.integrationSlugs.join(", ") : "none";

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
    `Connected integrations: ${integrations}`,
    "",
    "Rules:",
    "- Be specific and reference the actual work above; never write generic filler.",
    "- Do not repeat a suggestion you already made; check your memory first.",
    "- Store what you suggest to memory so future updates stay fresh.",
    `- If there is genuinely nothing valuable to add, reply with exactly ${NOTHING_TO_REPORT} and nothing else.`,
  ].join("\n");
}

async function fireInitiative(projectId: string, now: Date, opts: TickOptions) {
  // One initiative per spacing window: overlapping ticks that both pass the
  // gates resolve to the same idempotency key and only the first one fires.
  const day = now.toISOString().slice(0, 10);
  const slot = Math.floor(now.getTime() / INITIATIVE_MIN_SPACING_MS);
  const idempotencyKey = `initiative:${slot}`;
  if (await getRunByIdempotencyKey(projectId, idempotencyKey)) return false;

  const [recentMessages, integrationSlugs] = await Promise.all([
    listRecentUserMessages(projectId),
    listConnectedIntegrationSlugs(projectId),
  ]);

  const message = buildInitiativePrompt({ now, recentMessages, integrationSlugs });
  const thread = await upsertThread(projectId, `initiative:${day}`);
  const run = await createRun({
    threadId: thread.id,
    projectId,
    input: { message },
    idempotencyKey,
    source: "initiative",
  });

  const job = {
    runId: run.id,
    projectId,
    threadId: thread.id,
    payload: { message, source: "initiative" },
  };

  if (opts.inline) {
    await enqueueAndProcess(job);
  } else {
    await getQueue().enqueue(job);
  }
  return true;
}

/**
 * Fire an initiative run for each idle project that passes the gates.
 * The daily cap and spacing are derived from kasie_runs, so overlapping
 * ticks converge on the same decision.
 */
export async function runInitiativeTick(opts: TickOptions = {}): Promise<number> {
  const now = opts.now ?? new Date();
  let fired = 0;

  for (const project of await listProactiveCandidateProjects()) {
    try {
      const stats = await getInitiativeGateStats(project.projectId, now);
      const gate = evaluateInitiativeGate({
        proactiveEnabled: project.proactiveEnabled,
        timezone: project.timezone,
        workingHours: project.workingHours ?? null,
        projectCreatedAt: project.createdAt,
        ...stats,
        now,
      });

      if (!gate.fire) {
        log.debug("initiative gated", {
          projectId: project.projectId,
          reason: gate.reason,
        });
        continue;
      }

      if (await fireInitiative(project.projectId, now, opts)) {
        fired++;
        log.info("initiative fired", { projectId: project.projectId });
      }
    } catch (err) {
      log.error("initiative failed", { projectId: project.projectId }, err);
    }
  }

  return fired;
}
