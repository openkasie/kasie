# API Reference

This page is an operator reference for every HTTP endpoint Kasie exposes today. It is not a stable public API: routes, payloads, and auth can change between releases without deprecation. Treat it as documentation of the current surface, useful for debugging, wiring schedulers, and light automation.

All routes live under `src/app/api/`. Three kinds of authentication appear:

| Auth | Used by | How |
|---|---|---|
| Browser session | Dashboard-facing routes | NextAuth session cookie; you must be signed in with access to the active project. |
| API key | Agent run routes | `Authorization: Bearer <key>` checked against hashed keys in the `kasie_api_keys` table. Keys are org-scoped; create them in the dashboard. |
| Cron secret | Heartbeat | `Authorization: Bearer <CRON_SECRET>`. Required in production (the env loader refuses to boot without `CRON_SECRET` set); in development an unset secret allows unauthenticated calls so local testing works. |

## Agent runs

### POST /api/agent/v1/runs

Create and execute a run. Auth: API key.

```bash
curl -X POST https://your-app.example.com/api/agent/v1/runs \
  -H "Authorization: Bearer $KASIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Summarize open incidents",
    "project_id": "<project uuid>",
    "idempotency_key": "incident-summary-2026-08-28",
    "model": "smart"
  }'
```

Body fields: `input` (required), `project_id` (required, must belong to the key's org), `thread_id` (optional, reuse to continue a conversation), `idempotency_key` (optional, a repeat call with the same key returns the original run instead of creating a duplicate), `model` (optional tier: `ultra`, `smart`, or `balanced`).

The run is processed inline; the response usually already carries the final state:

```json
{ "id": "...", "thread_id": "...", "status": "completed", "output": { "text": "..." } }
```

Errors: `401` bad key, `403` project not in your org, `404` unknown project, `429` with `budget_exceeded` when the org's monthly budget is spent.

### GET /api/runs/{runId}

Fetch one run by ID. Auth: API key, org-scoped. Returns `id`, `thread_id`, `project_id`, `status` (`queued`, `running`, `awaiting_approval`, `completed`, `failed`, `cancelled`), `input`, `output`, `started_at`, `completed_at`.

## Scheduling

### POST /api/cron/heartbeat

Deployment-agnostic proactive tick: fires due rows in `kasie_schedules` and the initiative loop, processing resulting runs inline so worker-less deployments complete them. Auth: cron secret. Safe to call concurrently and from any scheduler (Vercel Cron per [Deploy on Vercel](9-deploy-vercel.md), a crontab line, Kubernetes CronJob, EventBridge, or curl).

```bash
curl -X POST https://your-app.example.com/api/cron/heartbeat \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response: `{"ok":true,"schedulesFired":0,"initiativesFired":0}`. `401` means the bearer token does not match.

## Slack

These are called by Slack, not by you; you configure their URLs via the app manifest (see [Slack App Setup](2-slack-app-setup.md)).

### POST /api/slack/events

Slack Events API receiver. Answers `url_verification` challenges, then handles `message` and `app_mention` events: it resolves the tenant by `team_id` (unknown workspaces get `{"ok":true,"warning":"unknown tenant"}`), checks the org budget, upserts the thread, creates a run with idempotency key `slack:{ts}` so Slack's retries never duplicate work, reacts to the message, and processes the run after responding. Bot-authored messages are ignored.

### POST /api/slack/interactions

Slack interactivity receiver (button clicks). Handles approve and reject buttons for pending actions: approve resolves the `kasie_pending_actions` row and resumes the run, executing the approved tool; reject resolves it as rejected.

### GET /api/slack/oauth/callback

OAuth redirect target for both Sign in with Slack and the bot install. During first-run bootstrap it provisions the org, project, and Slack integration; afterwards it binds or rebinds a workspace to an existing project. Driven by the [Onboarding](6-onboarding.md) wizard; not useful to call by hand.

## Pipedream (integrations)

### POST /api/pipedream/connect-token

Start a connect flow. Auth: browser session with project access. Returns `503` when Pipedream env vars are missing. Body: `{ "appSlug": "github", "visibility": "workspace" | "private", "integrationId": "<uuid, optional>" }`. Creates a pending `kasie_integrations` row (unless `integrationId` points at an existing one) and returns a short-lived Connect token plus `connectLinkUrl` for the OAuth iframe. See [Integrations](12-integrations.md).

### POST /api/pipedream/webhook

Receiver for Pipedream Connect webhooks. On `CONNECTION_SUCCESS` it marks the matching pending integration `connected` and enqueues discovery; other events are acknowledged and skipped. Honest note: this route currently performs no signature verification; the `PIPEDREAM_WEBHOOK_SECRET` line in `.env.example` is not read by any code yet. The blast radius is limited (it can only complete an already-pending row for a real Pipedream account), but do not point anything else at this URL.

## Auth

### /api/auth/[...nextauth]

NextAuth's standard endpoints (sign-in, callback, session, sign-out) for the dashboard. Configured providers depend on env: Slack, plus optional Google and GitHub for invite-only return sign-in. See [Environment Variables](7-environment-variables.md).

## Not an API: server actions

Most dashboard mutations (creating schedules, editing integrations, toggling skills) are Next.js Server Actions, not REST routes. They are invoked by the dashboard UI with session auth and are not callable as documented endpoints.
