import type { RunJob } from "@/lib/ai/types";
import type { QueueProvider } from "./types";

type TrackedJob = RunJob & { status: "pending" | "processing" | "completed" };

export class MemoryQueue implements QueueProvider {
  private jobs: TrackedJob[] = [];

  async enqueue(job: Omit<RunJob, "id">): Promise<RunJob> {
    const full: TrackedJob = { ...job, id: crypto.randomUUID(), status: "pending" };
    this.jobs.push(full);
    return full;
  }

  async tryClaim(jobId: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "pending") return false;
    job.status = "processing";
    return true;
  }

  async dequeue(): Promise<RunJob | null> {
    const job = this.jobs.find((j) => j.status === "pending");
    if (!job) return null;
    job.status = "processing";
    return job;
  }

  async ack(jobId: string): Promise<void> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) job.status = "completed";
  }

  async nack(jobId: string): Promise<void> {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) job.status = "pending";
  }
}
