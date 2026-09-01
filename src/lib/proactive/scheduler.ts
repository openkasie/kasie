import { enqueueAndProcess } from "@/lib/agents/process-run";
import { createRun } from "@/lib/db/queries/runs";
import { upsertThread } from "@/lib/db/queries/projects";
import {
  claimDueSchedule,
  disableBrokenSchedule,
  initializeNextRun,
  listDueSchedules,
  listEnabledSchedulesMissingNextRun,
} from "@/lib/db/queries/schedules";
import { createLogger } from "@/lib/log";
import { getQueue } from "@/lib/queue";
import type { Schedule } from "@/lib/db/schema";
import { nextAfter } from "./cron";

const log = createLogger("proactive:scheduler");

export type TickOptions = {
  /**
   * Process enqueued runs in the same call instead of leaving them for the
   * worker. Used by the heartbeat endpoint so deployments without a worker
   * (Vercel, web-only local) still complete proactive runs.
   */
  inline?: boolean;
  now?: Date;
};

async function fireSchedule(schedule: Schedule, opts: TickOptions) {
  const thread = await upsertThread(schedule.projectId, `schedule:${schedule.id}`);
  const run = await createRun({
    threadId: thread.id,
    projectId: schedule.projectId,
    input: { message: schedule.prompt, scheduleId: schedule.id },
    source: "schedule",
  });

  const job = {
    runId: run.id,
    projectId: schedule.projectId,
    threadId: thread.id,
    payload: {
      message: schedule.prompt,
      source: "schedule",
      scheduleId: schedule.id,
      scheduleTitle: schedule.title,
      channel: schedule.channel,
    },
  };

  if (opts.inline) {
    await enqueueAndProcess(job);
  } else {
    await getQueue().enqueue(job);
  }
}

/**
 * Enqueue runs for every enabled schedule whose next_run_at has passed.
 * Safe to call from any number of concurrent triggers: each due schedule is
 * claimed atomically before its run is created.
 */
export async function runSchedulerTick(opts: TickOptions = {}): Promise<number> {
  const now = opts.now ?? new Date();

  // Newly enabled or legacy schedules start from their next occurrence
  // instead of firing immediately for a long-past slot.
  for (const schedule of await listEnabledSchedulesMissingNextRun()) {
    const next = nextAfter(schedule.cron, now, schedule.timezone);
    if (!next) {
      log.warn("invalid cron; disabling schedule", {
        scheduleId: schedule.id,
        cron: schedule.cron,
      });
      await disableBrokenSchedule(schedule.id);
      continue;
    }
    await initializeNextRun(schedule.id, next);
  }

  let fired = 0;
  for (const schedule of await listDueSchedules(now)) {
    const next = nextAfter(schedule.cron, now, schedule.timezone);
    if (!next) {
      log.warn("invalid cron; disabling schedule", {
        scheduleId: schedule.id,
        cron: schedule.cron,
      });
      await disableBrokenSchedule(schedule.id);
      continue;
    }

    const claimed = await claimDueSchedule(
      schedule.id,
      schedule.nextRunAt!,
      next,
      now,
    );
    if (!claimed) continue;

    try {
      await fireSchedule(schedule, opts);
      fired++;
      log.info("schedule fired", {
        scheduleId: schedule.id,
        projectId: schedule.projectId,
        nextRunAt: next.toISOString(),
      });
    } catch (err) {
      log.error("schedule fire failed", { scheduleId: schedule.id }, err);
    }
  }

  return fired;
}
