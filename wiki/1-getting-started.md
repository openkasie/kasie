# Getting Started

This page is for anyone running Kasie for the first time. It covers the minimum requirements, the local quick start, and exactly what works (and what does not) at each level of configuration.

## Minimum requirements

- **Node.js 22 or newer.** The Docker image is built from `node:22-alpine`, and local tooling targets the same version.
- **npm.** Kasie uses plain npm as its package manager. There is no pnpm or yarn lockfile.
- **A Postgres database with the pgvector extension.** pgvector is a Postgres extension that stores embeddings, numeric fingerprints of text that let the database search by meaning. Kasie's first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, so the extension must be installable on your database. [Neon](https://neon.tech) is the recommended host: it ships pgvector out of the box, and Kasie's runtime database client is the Neon serverless HTTP driver (see `src/lib/db/client.ts`). The Docker deployment bundles a `pgvector/pgvector` Postgres container, but note the runtime-driver caveat before relying on it (see [Deploy with Docker](10-deploy-docker.md)).

That is the whole list. There is no Redis and no message broker: the job queue is Postgres-backed by default (`QUEUE_PROVIDER=postgres`).

`DATABASE_URL` is the only environment variable Kasie strictly requires to boot. In production (`NODE_ENV=production`), `AUTH_SECRET` and `CRON_SECRET` become required too; the app fails closed at startup if they are missing (validated in `src/lib/env/index.ts`).

## Quick start

```bash
git clone https://github.com/openkasie/kasie.git
cd kasie
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string
npm install
npm run db:migrate
npm run dev
```

Then open http://localhost:3000.

What each step does:

1. `cp .env.example .env` copies the annotated template. Every variable is documented inline and in full in [Environment Variables](7-environment-variables.md).
2. `npm run db:migrate` applies the SQL migrations in `drizzle/` (currently three files, starting with `0000_initial.sql`, which enables pgvector and creates all tables). It runs `drizzle-kit migrate` with your `.env` loaded (see `scripts/db.mjs`).
3. `npm run dev` runs `scripts/dev.mjs`, which builds the background worker, starts Next.js, and starts the worker alongside it. The worker is a separate Node process that pulls jobs (agent runs, scheduled tasks) from the Postgres queue.

There is no seed script and none is needed. On first run with an empty database, visiting `/` redirects you to `/onboarding`, the bootstrap wizard that creates the first user and workspace (routing logic in `src/app/page.tsx`). See [Onboarding](6-onboarding.md) for the full walkthrough.

## What you get at each configuration level

With **only `DATABASE_URL`** set:

- The web app boots, onboarding works up to the Slack connect step, and the dashboard is usable.
- The agent replies with `[stub]` output instead of real AI responses, because no AI provider is configured.
- The Slack connect step shows "Slack app not configured yet" and no channel can be bound.

Each extra set of variables unlocks a capability:

| Variables | Unlocks |
|-----------|---------|
| `AI_GATEWAY_URL` + `AI_GATEWAY_API_KEY` | Live AI responses instead of `[stub]` output. The gateway is an OpenAI-compatible API endpoint that fronts your model provider(s). |
| `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` | The Slack tile on `/onboarding` and the full Slack channel: sign-in, bot install, @mentions, DMs. See [Slack App Setup](2-slack-app-setup.md). |
| `PIPEDREAM_CLIENT_ID` + `PIPEDREAM_CLIENT_SECRET` + `PIPEDREAM_PROJECT_ID`, plus `ENCRYPTION_KEY` | External app integrations through Pipedream Connect. `ENCRYPTION_KEY` (64 hex characters, generate with `openssl rand -hex 32`) keys the credential vault, which is implemented but not yet wired into credential writes. See [Integrations](12-integrations.md). |
| `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET` | Extra invite-only sign-in providers for returning users. Not used for the first install. |
| `NGROK_AUTHTOKEN` + `NGROK_DOMAIN` | A public HTTPS tunnel during `npm run dev`, so Slack can reach your local machine. See [Slack App Setup](2-slack-app-setup.md). |

## Useful scripts

All defined in `package.json`:

| Command | What it does |
|---------|--------------|
| `npm run dev` | Worker build, Next.js dev server, worker, and optional ngrok tunnel (`scripts/dev.mjs`). |
| `npm run build` | Production build: `next build` plus the worker bundle. |
| `npm start` | Serves the production Next.js build. |
| `npm run worker` | Runs the built worker (`node dist/main.js`). |
| `npm run db:generate` | Generates a new migration from schema changes (`drizzle-kit generate`). |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:fresh` | **Destructive.** Drops the `public` schema and re-migrates, giving you an empty database (useful for re-testing onboarding). Refuses to run against a production database unless you pass `-- --force`. |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript check, and the Node test suite. |
| `npm run slack:manifest` | Renders the Slack app manifest for your public URL. See [Slack App Setup](2-slack-app-setup.md). |

Two dev-only knobs, both read by `scripts/dev.mjs`:

- `DEV_PORT=3002` if port 3000 is taken. Next.js and the ngrok tunnel must share the same port, so the script exits early with a clear message instead of silently drifting to another port.
- `WEB_ONLY=1` skips the worker and instead POSTs `/api/cron/heartbeat` every `PROACTIVE_TICK_MS` (default 60000 ms) to drive scheduled work over HTTP, the same way a Vercel deployment does.

## Where to go next

- Wire up real chat: [Slack App Setup](2-slack-app-setup.md), then [Onboarding](6-onboarding.md).
- Understand every knob: [Environment Variables](7-environment-variables.md).
- Understand the moving parts: [Architecture](8-architecture.md).
- Something broke: [Troubleshooting](16-troubleshooting.md).
