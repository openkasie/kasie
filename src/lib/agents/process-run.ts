import { buildRunContext, orchestrator } from "@/lib/agents/orchestrator";
import { updateRunStatus } from "@/lib/db/queries/runs";
import { createLogger } from "@/lib/log";
import { deliverProactiveOutput } from "@/lib/proactive/deliver";
import { getQueue } from "@/lib/queue";
import type { RunJob } from "@/lib/ai/types";

const log = createLogger("process-run");

export async function processRunJob(job: RunJob) {
  const queue = getQueue();
  const jobLog = log.child({
    jobId: job.id,
    runId: job.runId,
    projectId: job.projectId,
    threadId: job.threadId,
    source: job.payload.source ?? "message",
  });

  try {
    jobLog.info("run processing started");
    const ctx = await buildRunContext(job.projectId, job.threadId, job.runId);
    const source = job.payload.source;

    if (source === "integration_discovery") {
      const integrationId = String(job.payload.integrationId ?? "");
      if (!integrationId) throw new Error("integrationId required");
      jobLog.info("integration discovery started", { integrationId });
      await orchestrator.runIntegrationDiscovery(ctx, integrationId);
      await queue.ack(job.id);
      jobLog.info("integration discovery completed", { integrationId });
      return;
    }

    const message = String(job.payload.message ?? "");
    jobLog.debug("message run started", { messageLength: message.length });
    const result = await orchestrator.executeRun(ctx, { message, metadata: job.payload });

    // Proactive runs have no inbound Slack message to reply to; deliver here.
    if (source === "schedule" || source === "initiative") {
      await deliverProactiveOutput({
        projectId: job.projectId,
        source,
        text: result.text,
        channel: typeof job.payload.channel === "string" ? job.payload.channel : null,
        title:
          typeof job.payload.scheduleTitle === "string"
            ? job.payload.scheduleTitle
            : null,
      });
    }

    await queue.ack(job.id);
    jobLog.info("message run completed");
  } catch (err) {
    jobLog.error("run failed", undefined, err);
    try {
      await updateRunStatus(job.runId, "failed", {
        error: err instanceof Error ? err.message : "run failed",
      });
    } catch (statusErr) {
      jobLog.error("failed to mark run as failed", undefined, statusErr);
    }
    await queue.nack(job.id);
    throw err;
  }
}

export async function enqueueAndProcess(job: Omit<RunJob, "id">) {
  const queue = getQueue();
  const enqueued = await queue.enqueue(job);
  log.info("run enqueued for inline processing", {
    jobId: enqueued.id,
    runId: enqueued.runId,
    projectId: enqueued.projectId,
    source: enqueued.payload.source ?? "message",
  });
  await processRunJob(enqueued);
  return enqueued;
}
