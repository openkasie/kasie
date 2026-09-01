import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runProactiveTick } from "@/lib/proactive/tick";

/**
 * Deployment-agnostic heartbeat. Any external scheduler works: Vercel Cron,
 * a crontab line, a Kubernetes CronJob, EventBridge, or a manual curl. Runs
 * enqueued here are also processed inline so web-only deployments (no worker)
 * still complete and deliver proactive runs.
 *
 * Auth: bearer CRON_SECRET, required in production (the env loader fails
 * closed there). In development an unset secret allows unauthenticated
 * requests so `curl -X POST localhost:3000/api/cron/heartbeat` works on a
 * fresh checkout.
 */
function isAuthorized(request: Request): boolean {
  if (env.CRON_SECRET) {
    return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  }
  return env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runProactiveTick({ inline: true });
  return NextResponse.json({ ok: true, ...result });
}
