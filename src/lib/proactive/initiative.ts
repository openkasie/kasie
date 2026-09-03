import { enqueueAndProcess } from "@/lib/agents/process-run";
import {
  getInitiativeGateStats,
  listConnectedIntegrationSlugs,
  listPendingApprovals,
  listProactiveCandidateProjects,
  listRecentInitiativeTexts,
  listRecentUserMessages,
  listSilentSchedules,
} from "@/lib/db/queries/proactive";
import { createRun, getRunByIdempotencyKey } from "@/lib/db/queries/runs";
import { upsertThread } from "@/lib/db/queries/projects";
import { createLogger } from "@/lib/log";
import { getQueue } from "@/lib/queue";
import { NOTHING_TO_REPORT } from "./constants";
import { evaluateInitiativeGate, INITIATIVE_MIN_SPACING_MS } from "./gates";
import { buildInitiativePrompt } from "./initiative-prompt";
import type { TickOptions } from "./scheduler";

const log = createLogger("proactive:initiative");

async function fireInitiative(projectId: string, now: Date, opts: TickOptions) {
  // One initiative per spacing window: overlapping ticks that both pass the
  // gates resolve to the same idempotency key and only the first one fires.
  const day = now.toISOString().slice(0, 10);
  const slot = Math.floor(now.getTime() / INITIATIVE_MIN_SPACING_MS);
  const idempotencyKey = `initiative:${slot}`;
  if (await getRunByIdempotencyKey(projectId, idempotencyKey)) return false;

  const [recentMessages, integrationSlugs, pendingApprovals, initiativeTexts, silentSchedules] =
    await Promise.all([
      listRecentUserMessages(projectId),
      listConnectedIntegrationSlugs(projectId),
      listPendingApprovals(projectId),
      listRecentInitiativeTexts(projectId),
      listSilentSchedules(projectId, NOTHING_TO_REPORT),
    ]);

  const message = buildInitiativePrompt({
    now,
    recentMessages,
    integrationSlugs,
    looseEnds: {
      pendingApprovals,
      priorInitiatives: initiativeTexts
        .filter((t) => t !== NOTHING_TO_REPORT)
        .slice(0, 3),
      silentSchedules,
    },
  });
  const thread = await upsertThread(projectId, `initiative:${day}`);
  const run = await createRun({
    threadId: thread.id,
    projectId,
    input: { message },
    idempotencyKey,
    source: "initiative",
  });
  if (!run) return false;

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
