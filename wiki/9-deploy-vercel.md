# Deploy on Vercel

This page is for operators deploying Kasie to Vercel, the zero-server path. It covers how Kasie runs without a long-lived worker, the cron heartbeat, and the exact configuration in `deploy/vercel/vercel.json`.

## How Kasie runs on Vercel

Vercel runs serverless functions: short-lived processes that start per request and stop after responding. That means no always-on worker polling the queue. Kasie is built for this:

- **Inbound work** (Slack messages, API run requests) is processed inside the request itself. The route responds fast, then keeps working via Next.js `after()`.
- **Proactive work** (scheduled tasks from `kasie_schedules`, the initiative loop) is fired by a cron job. Cron is a scheduler that runs a command or request on a fixed timetable. Vercel Cron sends `POST /api/cron/heartbeat` on the schedule in `vercel.json`, and the heartbeat processes any runs it enqueues inline, so nothing waits for a worker that does not exist.

The queue still lives in the `kasie_queue_jobs` Postgres table (see [Architecture](8-architecture.md)); on Vercel it is drained inline rather than by a poller.

## vercel.json

The file at `deploy/vercel/vercel.json` configures the cron schedule and function time limits:

```json
{
  "crons": [
    {
      "path": "/api/cron/heartbeat",
      "schedule": "*/5 * * * *"
    }
  ],
  "functions": {
    "src/app/api/slack/events/route.ts": { "maxDuration": 60 },
    "src/app/api/agent/v1/runs/route.ts": { "maxDuration": 300 },
    "src/app/api/cron/heartbeat/route.ts": { "maxDuration": 300 }
  }
}
```

- `*/5 * * * *` means every 5 minutes. Scheduled tasks fire at most 5 minutes late; the schedule claim in the database is atomic, so overlapping triggers never double-fire a task.
- The `maxDuration` values give agent runs up to 300 seconds. Slack event handling gets 60 seconds, enough to ack and finish a typical run.

Vercel reads `vercel.json` from the project root it builds. If your Vercel project root is the `kasie/` directory, copy `deploy/vercel/vercel.json` there (or recreate the `crons` and `functions` entries in your own root `vercel.json`).

## Setup steps

1. **Create the database.** Neon is the recommended Postgres: the runtime client is the Neon HTTP driver, and Neon ships pgvector. Grab the connection string.

2. **Run migrations** from your machine against the production database:

```bash
cd kasie
DATABASE_URL="postgresql://...neon.tech/kasie?sslmode=require" npm run db:migrate
```

The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, so nothing manual is needed on Neon.

3. **Create the Vercel project** pointing at the repo with root directory `kasie/`. The build command is the default `npm run build` (which also bundles the worker; the bundle is unused on Vercel but harmless).

4. **Set environment variables** in the Vercel project settings. The full reference is [Environment Variables](7-environment-variables.md); the production-relevant set:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Required. |
| `AUTH_SECRET` | Required in production. The env loader fails closed: the app refuses to serve without it. Generate with `openssl rand -base64 32`. |
| `CRON_SECRET` | Required in production, same fail-closed rule. Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` on cron invocations when the variable is set. |
| `APP_URL` | Your public URL, e.g. `https://kasie.example.com`. Needed for the Pipedream webhook callback. |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | For Slack sign-in and bot install; see [Slack App Setup](2-slack-app-setup.md). |
| `AI_GATEWAY_URL`, `AI_GATEWAY_API_KEY` | Without these every reply is `[stub]` text. |
| `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID` | Optional; enables integrations. |
| `DEPLOY_TARGET` | Defaults to `vercel`; no need to set it. |
| `QUEUE_PROVIDER` | Leave as the default `postgres`. |

5. **Deploy**, then finish setup at `https://your-app.example.com/onboarding` (see [Onboarding](6-onboarding.md)).

## Verifying the heartbeat

You can trigger the heartbeat manually at any time; concurrent triggers are safe:

```bash
curl -X POST https://your-app.example.com/api/cron/heartbeat \
  -H "Authorization: Bearer $CRON_SECRET"
```

A healthy response looks like `{"ok":true,"schedulesFired":0,"initiativesFired":0}`. A `401` means the bearer token does not match `CRON_SECRET`. If scheduled tasks are not firing, start with this curl; see [Troubleshooting](16-troubleshooting.md).

## Limits of the Vercel shape

- Scheduled tasks have up to 5 minutes of latency (the cron interval).
- A run must finish within the function `maxDuration` (300 seconds). Very long tool-heavy runs can hit the ceiling.
- Do not set `QUEUE_PROVIDER=memory` here: each serverless invocation is a separate process, so an in-memory queue loses jobs.

If you need an always-on worker, use [Docker](10-deploy-docker.md) or [ECS](11-deploy-ecs.md) instead.
