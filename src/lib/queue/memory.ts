import type { RunJob } from "@/lib/ai/types";
import type { QueueProvider } from "./types";

export class MemoryQueue implements QueueProvider {
  private jobs: RunJob[] = [];

  async enqueue(job: Omit<RunJob, "id">): Promise<RunJob> {
    const full: RunJob = { ...job, id: crypto.randomUUID() };
    this.jobs.push(full);
    return full;
  }

  async dequeue(): Promise<RunJob | null> {
    return this.jobs.shift() ?? null;
  }

  async ack(_jobId: string): Promise<void> {}

  async nack(job: string): Promise<void> {
    void job;
  }
}
