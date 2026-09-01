import { createLogger } from "@/lib/log";
import { runInitiativeTick } from "./initiative";
import { runSchedulerTick, type TickOptions } from "./scheduler";

const log = createLogger("proactive:tick");

export type TickResult = {
  schedulesFired: number;
  initiativesFired: number;
};

/**
 * Single deployment-agnostic heartbeat entry point. Safe to call from any
 * number of concurrent triggers (worker ticker, external cron hitting the
 * heartbeat endpoint, manual curl): due schedules are claimed atomically and
 * initiative runs are idempotent per spacing window.
 */
export async function runProactiveTick(opts: TickOptions = {}): Promise<TickResult> {
  const schedulesFired = await runSchedulerTick(opts);
  const initiativesFired = await runInitiativeTick(opts);

  if (schedulesFired > 0 || initiativesFired > 0) {
    log.info("tick completed", { schedulesFired, initiativesFired });
  }
  return { schedulesFired, initiativesFired };
}
