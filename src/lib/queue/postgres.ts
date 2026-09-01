import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { kasieQueueJobs } from "@/lib/db/schema";
import type { RunJob } from "@/lib/ai/types";
import { createLogger } from "@/lib/log";
import type { QueueProvider } from "./types";

const log = createLogger("queue");

export class PostgresQueue implements QueueProvider {
  async enqueue(job: Omit<RunJob, "id">): Promise<RunJob> {
    const [row] = await db
      .insert(kasieQueueJobs)
      .values({
        runId: job.runId,
        projectId: job.projectId,
        payload: { ...job.payload, threadId: job.threadId },
        status: "pending",
      })
      .returning();

    const enqueued = {
      id: row.id,
      runId: row.runId,
      projectId: row.projectId,
      threadId: job.threadId,
      payload: row.payload as Record<string, unknown>,
    };
    log.info("job enqueued", {
      jobId: enqueued.id,
      runId: enqueued.runId,
      projectId: enqueued.projectId,
      source: enqueued.payload.source ?? "message",
    });
    return enqueued;
  }

  async dequeue(): Promise<RunJob | null> {
    const [row] = await db
      .select()
      .from(kasieQueueJobs)
      .where(eq(kasieQueueJobs.status, "pending"))
      .limit(1);

    if (!row) return null;

    await db
      .update(kasieQueueJobs)
      .set({ status: "processing", lockedAt: new Date() })
      .where(eq(kasieQueueJobs.id, row.id));

    const payload = row.payload as Record<string, unknown>;
    const job = {
      id: row.id,
      runId: row.runId,
      projectId: row.projectId,
      threadId: String(payload.threadId ?? ""),
      payload,
    };
    log.debug("job dequeued", {
      jobId: job.id,
      runId: job.runId,
      projectId: job.projectId,
      source: payload.source ?? "message",
    });
    return job;
  }

  async ack(jobId: string): Promise<void> {
    await db
      .update(kasieQueueJobs)
      .set({ status: "completed" })
      .where(eq(kasieQueueJobs.id, jobId));
    log.debug("job acked", { jobId });
  }

  async nack(jobId: string): Promise<void> {
    await db
      .update(kasieQueueJobs)
      .set({ status: "pending", lockedAt: null })
      .where(eq(kasieQueueJobs.id, jobId));
    log.warn("job nacked", { jobId });
  }
}
