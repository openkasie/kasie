# Troubleshooting

This page is for operators debugging a Kasie install. Each section is a symptom, the likely causes in order, and the commands to confirm them. General tools first: web and worker logs (structured lines with `runId` and `projectId`), the `kasie_runs` table for run status, and `kasie_queue_jobs` for stuck jobs.

## Slack events are not arriving

Symptom: you @mention Kasie or DM it and nothing happens, not even the processing reaction.

1. **Local dev: the tunnel is down.** Slack can only reach a public URL. `npm run dev` starts an ngrok tunnel (a service that forwards a public HTTPS URL to your machine) only when both `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are set in `.env`; otherwise it prints `Slack tunnel skipped`. If ngrok fails with `ERR_NGROK_334` or `already online`, another session still holds the domain: stop it at the ngrok dashboard (Agents or Endpoints), wait about 30 seconds, retry.
2. **The manifest points at the wrong URLs.** The Slack app's event URL must be exactly `{your-public-origin}/api/slack/events`, interactivity `{origin}/api/slack/interactions`, OAuth redirect `{origin}/api/slack/oauth/callback`. Regenerate with `npm run slack:manifest -- https://your-origin` and update the app at api.slack.com. Slack must show the events URL as Verified (Kasie answers the `url_verification` challenge automatically when the URL is right). Details: [Slack App Setup](2-slack-app-setup.md).
3. **The workspace is not bound to a project.** If the web log shows `unknown tenant`, events arrive but no project matches that Slack `team_id`. Finish the bot install via [Onboarding](6-onboarding.md), or rebind after a `db:fresh`.
4. **Scopes changed; reinstall needed.** After editing the manifest's scopes, Slack requires reinstalling the app to the workspace before events flow with the new permissions.
5. **Missing event subscriptions.** The manifest subscribes to `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim`. Kasie ignores events without text and everything sent by bots, so bot-posted messages never triggering a reply is by design.

## The agent replies with "[stub] ..." text

Symptom: Kasie answers instantly with `[stub]` followed by an echo of your prompt.

This is the built-in fallback when no AI provider is configured: both `AI_GATEWAY_URL` and `AI_GATEWAY_API_KEY` must be set (`hasAiProvider()` in `src/lib/env/index.ts`). Set both, restart, and check logs for `stub response (no AI provider configured)` disappearing. Note that without a provider, memory embeddings are placeholder vectors too, so retrieval is meaningless until real keys are in place. Reference: [Environment Variables](7-environment-variables.md).

## Migrations fail

Symptom: `npm run db:migrate` errors out.

1. **pgvector extension missing or not permitted.** The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`. On Neon this just works. On self-hosted Postgres the extension must be installed on the server (use the `pgvector/pgvector` images, as the Docker Compose file does with `pgvector/pgvector:pg18`) and your role must be allowed to create extensions. Error text mentioning `extension "vector" is not available` means the binary is missing from the server.
2. **Wrong `DATABASE_URL`.** The scripts read `.env` via `node --env-file`. Connection refused usually means the host or port is wrong for where you are running the command (from the host machine, the Compose database is `localhost:5432`, not `postgres:5432`). Auth errors mean user or password; Neon needs `?sslmode=require`.
3. **Half-applied state.** Drizzle tracks applied migrations in the `drizzle` schema. If a dev database got mangled, `npm run db:fresh` resets it. Read the warning below first.

## Integration connect fails

Symptom: the Connect button is disabled, errors, or the connection never becomes "connected".

1. **Pipedream env missing.** `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, and `PIPEDREAM_PROJECT_ID` must all be set; otherwise the modal says Pipedream is not configured and `POST /api/pipedream/connect-token` returns `503`.
2. **`ENCRYPTION_KEY` malformed.** If set, it must be exactly 64 hex characters (`openssl rand -hex 32`). Any other length fails env validation at boot with `Invalid environment: ENCRYPTION_KEY ...`, taking the whole app down, which looks like "everything broke after I added a key".
3. **Stuck in `pending` after OAuth.** Completion happens from the browser modal, with `POST /api/pipedream/webhook` as the server-side fallback; the fallback requires `APP_URL` to be set to your public URL at token-creation time. Check that the OAuth popup or iframe finished with a success message and was not blocked.
4. **Connected but discovery stuck `pending` or `failed`.** Discovery runs as a background job, so it needs a worker or the inline processing to have survived; see the scheduled-tasks section below for the same root causes. You can re-run discovery from the integration's dashboard page. More background: [Integrations](12-integrations.md).

## Scheduled tasks are not firing

Symptom: rows in `kasie_schedules` exist but nothing posts to Slack.

1. **Nothing is ticking.** Something must run the proactive tick: a live worker process (`node dist/main.js`, present in the Docker and ECS shapes) or an external scheduler calling `POST /api/cron/heartbeat` (the Vercel shape, every 5 minutes per `deploy/vercel/vercel.json`). If you run `npm run dev` with `WEB_ONLY=1`, the dev script drives the heartbeat itself. Verify by hand:

```bash
curl -X POST https://your-app.example.com/api/cron/heartbeat \
  -H "Authorization: Bearer $CRON_SECRET"
```

`401` means the bearer does not match `CRON_SECRET`. A healthy reply reports `schedulesFired`.
2. **The schedule is disabled or not yet due.** Schedules are created with `enabled = false` in the schema; check the flag and the `next_run_at` column. A newly enabled schedule starts from its next occurrence rather than firing immediately for a past slot.
3. **Invalid cron expression.** A cron string that cannot be parsed gets the schedule automatically disabled, with a `invalid cron; disabling schedule` warning in the logs.
4. **Proactive behavior turned off.** `proactive_enabled` in `kasie_project_config` gates initiative runs for the project.
5. **Delivery, not firing.** If runs complete (check `kasie_runs` with `source = 'schedule'`) but nothing appears in Slack, the schedule's `channel` may be wrong; with no channel set, delivery falls back to a DM to the org owner.

## npm run db:fresh: destructive reset warning

`npm run db:fresh` **drops the entire `public` and `drizzle` schemas**: all workspaces, runs, memories, integrations, and users in that database are gone, then migrations re-run on the empty database. It is meant for testing onboarding from scratch. It refuses to run when `NODE_ENV=production` unless you pass `--force`:

```bash
npm run db:fresh              # dev only, still deletes everything
npm run db:fresh -- --force   # overrides the production guard; be sure
```

After a fresh reset you must go through `/onboarding` again, and the Slack workspace will need rebinding.

## Other quick answers

- **App refuses to boot in production** with `Invalid environment: CRON_SECRET: required when NODE_ENV=production`: this is fail-closed by design; set `CRON_SECRET` and `AUTH_SECRET`.
- **Kasie replies about a spent budget**: the org's `monthly_budget_cents` in `kasie_orgs` is exhausted; raise or clear it and check spend in `kasie_usage_ledger`.
- **Jobs stuck `pending` in `kasie_queue_jobs`**: no worker is draining the queue (same fixes as scheduled tasks above). Jobs stuck `processing` mean a worker died mid-run; failed dequeues are automatically returned to `pending` on error, but a hard-killed process can strand a row: reset it with `UPDATE kasie_queue_jobs SET status = 'pending', locked_at = NULL WHERE id = '<id>';`
- **Port 3000 already taken in local dev**: set `DEV_PORT` in `.env`; the dev script prints which process holds the port.
