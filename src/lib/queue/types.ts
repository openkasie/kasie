import type { RunJob } from "@/lib/ai/types";

export interface QueueProvider {
  enqueue(job: Omit<RunJob, "id">): Promise<RunJob>;
  dequeue(): Promise<RunJob | null>;
  ack(jobId: string): Promise<void>;
  nack(jobId: string): Promise<void>;
}
