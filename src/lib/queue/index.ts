import { env } from "@/lib/env";
import { MemoryQueue } from "./memory";
import { PostgresQueue } from "./postgres";
import type { QueueProvider } from "./types";

let instance: QueueProvider | null = null;

export function getQueue(): QueueProvider {
  if (instance) return instance;

  switch (env.QUEUE_PROVIDER) {
    case "memory":
      instance = new MemoryQueue();
      break;
    case "postgres":
    default:
      instance = new PostgresQueue();
  }

  return instance;
}
