import { and, eq, sql } from "drizzle-orm";
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

  async tryClaim(jobId: string): Promise<boolean> {
    const [row] = await db
      .update(kasieQueueJobs)
      .set({ status: "processing", lockedAt: new Date() })
      .where(and(eq(kasieQueueJobs.id, jobId), eq(kasieQueueJobs.status, "pending")))
      .returning({ id: kasieQueueJobs.id });
    return row != null;
  }

  async dequeue(): Promise<RunJob | null> {
    const result = await db.execute(sql`
      UPDATE kasie_queue_jobs
      SET status = 'processing', locked_at = NOW()
      WHERE id = (
        SELECT id FROM kasie_queue_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, run_id, project_id, payload
    `);

    const row = result.rows[0] as
      | {
        id: string;
        run_id: string;
        project_id: string;
        payload: Record<string, unknown>;
      }
      | undefined;
    if (!row) return null;

    const job = {
      id: row.id,
      runId: row.run_id,
      projectId: row.project_id,
      threadId: String(row.payload.threadId ?? ""),
      payload: row.payload,
    };
    log.debug("job dequeued", {
      jobId: job.id,
      runId: job.runId,
      projectId: job.projectId,
      source: job.payload.source ?? "message",
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
