# Environment Variables

This page is the complete reference for every variable Kasie reads. It is written for operators filling in `.env` (copied from `.env.example`) and for anyone configuring a deployment.

Most variables are validated at startup by a Zod schema in `src/lib/env/index.ts`. If validation fails, the app refuses to boot with a message naming the bad variable. A few dev-only variables (`NGROK_AUTHTOKEN`, `NGROK_DOMAIN`, `DEV_PORT`, `WEB_ONLY`) are read only by `scripts/dev.mjs`, and `LOG_LEVEL` is read directly by the logger in `src/lib/log/index.ts`; those are not part of the Zod schema.

The one-line summary: **only `DATABASE_URL` is required to boot.** In production, `AUTH_SECRET` and `CRON_SECRET` are also required, and startup fails closed without them (so a production deploy can never expose unauthenticated endpoints by accident). Everything else unlocks an optional capability.

## Core

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `DATABASE_URL` | Always | Postgres connection string. The app connects through the Neon serverless HTTP driver (`src/lib/db/client.ts`); the database needs the pgvector extension. | Your Neon project's connection string, or your Postgres host. |
| `NODE_ENV` | Never (defaults to `development`) | Standard Node environment. `production` turns on the fail-closed secret checks below. | Set by your platform or process manager. |
| `DEPLOY_TARGET` | Never (defaults to `vercel`) | Tells Kasie which deployment profile it is running under: `vercel`, `ecs`, or `docker`. | Pick per your deploy path: [9](9-deploy-vercel.md), [10](10-deploy-docker.md), [11](11-deploy-ecs.md). |
| `QUEUE_PROVIDER` | Never (defaults to `postgres`) | Which job queue backs agent runs and scheduled work: `postgres` (default, no extra infrastructure), `sqs`, or `memory` (tests only, jobs vanish on restart). | Leave at `postgres` unless you are on ECS with SQS. |
| `QUEUE_URL` | When `QUEUE_PROVIDER=sqs` | The SQS queue URL. | AWS console, after creating the queue. See [Deploy on ECS](11-deploy-ecs.md). |
| `APP_URL` | Optional | Public HTTPS origin override used to build OAuth redirect URLs. Auto-set by the dev script when the ngrok tunnel is active; usually inferred from request headers otherwise. | Your deployment's public URL. |
| `LOG_LEVEL` | Optional | Log verbosity: `debug`, `info`, `warn`, or `error`. Defaults to `debug` in dev, `info` in production. | Pick one. |

## Auth

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `AUTH_SECRET` | `NODE_ENV=production` | Secret that Auth.js uses to sign and encrypt session material. Without it in production, the app refuses to start. | Generate it; see notes below. |
| `GOOGLE_CLIENT_ID` | Optional | Enables the invite-only "Continue with Google" button on `/sign-in`. Both ID and secret must be set. | Google Cloud console, OAuth credentials. |
| `GOOGLE_CLIENT_SECRET` | Optional | Pairs with the above. | Same place. |
| `GITHUB_CLIENT_ID` | Optional | Enables the invite-only "Continue with GitHub" button on `/sign-in`. Both ID and secret must be set. | GitHub, Developer settings, OAuth Apps. |
| `GITHUB_CLIENT_SECRET` | Optional | Pairs with the above. | Same place. |

Google and GitHub are return sign-in options only. The first install always goes through Slack during [Onboarding](6-onboarding.md), and OAuth sign-in only succeeds for emails that already exist in the database (enforced in `src/auth.ts`).

## Slack

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `SLACK_CLIENT_ID` | To use Slack at all | Client ID of your Kasie Slack app. Enables the Slack tile on `/onboarding`, Sign in with Slack, and the bot install flow (checked via `hasSlackOAuth()`). | Slack app's **Basic Information** page. See [Slack App Setup](2-slack-app-setup.md). |
| `SLACK_CLIENT_SECRET` | To use Slack at all | Pairs with the above. | Same page. |

## Other channels (planned, reserved)

These enable onboarding tiles but connect to nothing yet. Leave them unset. Details in the per-channel stubs.

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `TEAMS_CLIENT_ID` / `TEAMS_CLIENT_SECRET` | Never (channel not live) | Reserved for Microsoft Teams. | [Teams App Setup](3-teams-app-setup.md). |
| `GOOGLE_CHAT_CLIENT_ID` / `GOOGLE_CHAT_CLIENT_SECRET` | Never (channel not live) | Reserved for Google Chat. Distinct from `GOOGLE_CLIENT_ID`, which is sign-in. | [Google Chat App Setup](4-google-chat-app-setup.md). |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Never (channel not live) | Reserved for Discord. | [Discord App Setup](5-discord-app-setup.md). |

## Pipedream and integrations

Pipedream Connect is the OAuth vault Kasie uses to reach external apps: your teammates authorize each app with Pipedream, and Kasie calls the apps through Pipedream without ever holding raw passwords. All three of `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, and `PIPEDREAM_PROJECT_ID` must be set for integrations to light up (checked via `hasPipedream()`). See [Integrations](12-integrations.md).

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `PIPEDREAM_CLIENT_ID` | For integrations | OAuth client for your Pipedream Connect app. | Pipedream dashboard, your Connect project. |
| `PIPEDREAM_CLIENT_SECRET` | For integrations | Pairs with the above. | Same place. |
| `PIPEDREAM_PROJECT_ID` | For integrations | Which Pipedream project holds the connected accounts. | Same place. |
| `PIPEDREAM_ENVIRONMENT` | Never (defaults to `development`) | Pipedream environment: `development` or `production`. | Match your Pipedream project setup. |
| `PIPEDREAM_WEBHOOK_SECRET` | Currently unused | Listed in `.env.example` as reserved, but nothing in the code reads it today; the webhook route (`src/app/api/pipedream/webhook/route.ts`) does not verify a secret yet. | Not needed yet. |
| `ENCRYPTION_KEY` | Optional (recommended) | Key for the AES-256-GCM credential vault (AES-256-GCM is an authenticated encryption scheme, meaning tampering is detected, not just hidden). The vault (`src/lib/db/vault.ts`) is implemented but not yet wired into credential writes, so stored credentials are not encrypted today; see [Integrations](12-integrations.md). If set, must be exactly 64 hex characters; startup fails otherwise. | Generate it; see notes below. |

## AI

Without both gateway variables, Kasie boots fine but the agent answers with `[stub]` placeholder output instead of real model responses (checked via `hasAiProvider()`).

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `AI_GATEWAY_URL` | For live AI replies | Base URL of an OpenAI-compatible AI gateway (a single API endpoint that fronts one or more model providers). | Your gateway provider (for example Vercel AI Gateway) or your own proxy. |
| `AI_GATEWAY_API_KEY` | For live AI replies | API key for that gateway. | Same place. |
| `EMBEDDING_MODEL` | Optional (defaults to `text-embedding-3-small`) | Which model generates embeddings for [Memory](15-memory.md). | A model ID your gateway serves. |
| `MODEL_TIER_ULTRA` | Optional | Overrides the model ID for the "ultra" tier (hardest tasks). When the tier overrides are unset, Kasie discovers available models from the gateway and picks defaults automatically. | A model ID your gateway serves. |
| `MODEL_TIER_ULTRA_MAX_OUTPUT_TOKENS` | Optional | Max output tokens for the ultra tier. | Pick a positive integer. |
| `MODEL_TIER_SMART` | Optional | Overrides the model ID for the "smart" tier (default reasoning). | A model ID your gateway serves. |
| `MODEL_TIER_SMART_MAX_OUTPUT_TOKENS` | Optional | Max output tokens for the smart tier. | Pick a positive integer. |
| `MODEL_TIER_BALANCED` | Optional | Overrides the model ID for the "balanced" tier (cheap, quick tasks). | A model ID your gateway serves. |
| `MODEL_TIER_BALANCED_MAX_OUTPUT_TOKENS` | Optional | Max output tokens for the balanced tier. | Pick a positive integer. |

## Proactive heartbeat and worker

The heartbeat is the periodic tick that runs scheduled tasks and the initiative loop. Deployments with a worker (local dev, Docker, ECS) tick internally every `PROACTIVE_TICK_MS`, no external scheduler needed. Deployments without a worker (Vercel) trigger the same tick by POSTing `/api/cron/heartbeat` from any scheduler: Vercel Cron, a crontab line (crontab is the classic Unix scheduled-task list), a Kubernetes CronJob, or plain curl. Concurrent triggers are safe.

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `CRON_SECRET` | `NODE_ENV=production` | Bearer token that authenticates `POST /api/cron/heartbeat`. Required in production even if you never call the endpoint, so it is never left open. | Generate it; see notes below. |
| `PROACTIVE_TICK_MS` | Never (defaults to `60000`) | Milliseconds between heartbeat ticks. | Pick an interval. |
| `WEB_ONLY` | Optional, dev only | Set to `1` to make `npm run dev` skip the worker and drive the heartbeat over HTTP instead, simulating a Vercel-style deployment locally. | Set it yourself. |

## Local development

Read only by `scripts/dev.mjs`, never in production.

| Variable | Required when | What it does | Where to get it |
|----------|--------------|--------------|-----------------|
| `NGROK_AUTHTOKEN` | For the local Slack tunnel | Authenticates the ngrok tunnel that gives your machine a public HTTPS URL. Must be set together with `NGROK_DOMAIN`; setting only one is an error. | [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) |
| `NGROK_DOMAIN` | For the local Slack tunnel | Your reserved static ngrok domain (for example `kasie-dev.ngrok-free.app`), so the public URL survives restarts. | [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) |
| `DEV_PORT` | Optional (defaults to `3000`) | Port for the dev server and tunnel, for when 3000 is already taken. | Pick a free port, for example `3002`. |

## Notes on the tricky ones

**`AUTH_SECRET`.** Generate with either of:

```bash
npx auth secret
# or
openssl rand -base64 32
```

It signs and encrypts Auth.js session material. Changing it invalidates the cryptographic material behind existing sessions, so treat it as stable per deployment. Not enforced in development, strictly required in production.

**`CRON_SECRET`.** Any strong random string works:

```bash
openssl rand -base64 32
```

Whoever calls `POST /api/cron/heartbeat` must send `Authorization: Bearer <CRON_SECRET>`. This is how Vercel Cron (or your crontab) proves it is allowed to trigger scheduled work. Required in production so the endpoint is never unauthenticated.

**`ENCRYPTION_KEY`.** Must be exactly 64 hexadecimal characters, which encodes a 32-byte AES-256 key:

```bash
openssl rand -hex 32
```

It keys the credential vault in `src/lib/db/vault.ts`. Honest status: the vault is implemented but not yet wired into credential writes, so nothing is encrypted with this key today (the Slack bot token is stored as-is; see [Integrations](12-integrations.md)). Setting it now is still recommended so encryption can land without a re-key. Once wired in, losing the key makes encrypted credentials unreadable (integrations must be reconnected), and leaking it together with a database dump exposes them. Store it in a secret manager, not in the repo.

**Production build vs production serve.** `next build` runs with `NODE_ENV=production`, but the schema deliberately skips the `AUTH_SECRET`/`CRON_SECRET` requirement during the build phase (`NEXT_PHASE=phase-production-build` in `src/lib/env/index.ts`). Secrets are only enforced when the server actually starts, so you can build in CI without production secrets present.

**Where variables load from.** Local scripts (`npm run dev`, `npm run db:migrate`) load `.env` from the project root. Deployed environments should set real environment variables through the platform ([Vercel](9-deploy-vercel.md), [Docker](10-deploy-docker.md), [ECS](11-deploy-ecs.md)).
