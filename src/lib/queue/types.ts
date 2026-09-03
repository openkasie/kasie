import type { RunJob } from "@/lib/ai/types";

export interface QueueProvider {
  enqueue(job: Omit<RunJob, "id">): Promise<RunJob>;
  /** Atomically mark a pending job as processing for inline execution. */
  tryClaim(jobId: string): Promise<boolean>;
  dequeue(): Promise<RunJob | null>;
  ack(jobId: string): Promise<void>;
  nack(jobId: string): Promise<void>;
}
