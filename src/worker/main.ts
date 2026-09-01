import { processRunJob } from "@/lib/agents/process-run";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/log";
import { runProactiveTick } from "@/lib/proactive/tick";
import { getQueue } from "@/lib/queue";

const POLL_MS = 2000;
const log = createLogger("worker");

let lastTickAt = 0;

async function maybeTick() {
  const now = Date.now();
  if (now - lastTickAt < env.PROACTIVE_TICK_MS) return;
  lastTickAt = now;

  try {
    await runProactiveTick();
  } catch (err) {
    log.error("proactive tick failed", undefined, err);
  }
}

async function loop() {
  const queue = getQueue();
  log.info("worker started", { pollMs: POLL_MS, tickMs: env.PROACTIVE_TICK_MS });

  while (true) {
    await maybeTick();

    const job = await queue.dequeue();
    if (job) {
      const started = Date.now();
      const jobLog = log.child({
        jobId: job.id,
        runId: job.runId,
        projectId: job.projectId,
        source: job.payload.source ?? "message",
      });
      jobLog.info("job dequeued");

      try {
        await processRunJob(job);
        jobLog.info("job finished", { durationMs: Date.now() - started, ok: true });
      } catch (err) {
        jobLog.error("job failed", { durationMs: Date.now() - started }, err);
      }
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

loop().catch((err) => {
  log.error("worker fatal", undefined, err);
  process.exit(1);
});
