# Deploy with Docker

This page is for operators running Kasie on their own machine or server with Docker Compose. It covers the three containers, first-run migration, and an important caveat about the database driver.

## What Compose runs

`deploy/docker/docker-compose.yml` defines three services:

| Service | Image / command | Purpose |
|---|---|---|
| `postgres` | `pgvector/pgvector:pg18` | Postgres 18 with the pgvector extension preinstalled (pgvector stores embedding vectors and searches them by similarity). Data persists in the `kasie_pg` named volume. Exposed on host port 5432. |
| `web` | Built from `deploy/docker/Dockerfile`, default command `node server.js` | The Next.js app on port 3000. |
| `worker` | Same image, command `node dist/main.js` | The queue poller and scheduler. Because the worker ticks the scheduler internally every `PROACTIVE_TICK_MS` (default 60 seconds), no external cron is needed in this shape. |

Both app containers read your `.env` file (`env_file: ../../.env`) and then override `DEPLOY_TARGET=docker`, `QUEUE_PROVIDER=postgres`, and `DATABASE_URL=postgresql://kasie:kasie@postgres:5432/kasie`, pointing at the bundled database over the internal Compose network.

The Dockerfile is a multi-stage build on `node:22-alpine`: `npm ci`, `npm run build` (which produces both the Next.js standalone server and the worker bundle at `dist/main.js`), then a slim runtime layer running as a non-root user.

## Known caveat: the runtime database driver

The app's runtime database client is the Neon serverless HTTP driver (`drizzle-orm/neon-http` with `@neondatabase/serverless` in `src/lib/db/client.ts`). That driver talks Neon's HTTP protocol, not the standard Postgres wire protocol. Neon is the tested database today.

What this means in practice:

- Migrations work against the bundled container, because `scripts/db.mjs` and drizzle-kit use the standard `postgres` driver.
- Runtime queries from `web` and `worker` go through the Neon HTTP driver. Against the plain `pgvector/pgvector:pg18` container, expect connection failures unless you run a Neon-compatible HTTP proxy in front of it.

The practical recommendation: use Compose for the `web` and `worker` containers, and point `DATABASE_URL` in your `.env` at a Neon database (override the compose `environment:` blocks or remove them). Treat the bundled `postgres` service as the target state, not the tested path. If self-hosted Postgres support matters to you, watch the repo; the fix is swapping the client in `src/lib/db/client.ts` based on `DATABASE_URL`.

## Setup steps

1. **Prepare the env file.** In the `kasie/` directory:

```bash
cp .env.example .env
```

Fill in at least `AUTH_SECRET` and `CRON_SECRET` (the app fails closed in production without them; the Docker image runs with `NODE_ENV=production`). Add `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`, `AI_GATEWAY_URL`/`AI_GATEWAY_API_KEY`, and Pipedream keys as needed. Full reference: [Environment Variables](7-environment-variables.md).

2. **Start the stack:**

```bash
cd deploy/docker
docker compose up -d --build
```

3. **Run migrations** once, from the host, against the database the app will use. For the bundled container:

```bash
cd ../..   # back to kasie/
DATABASE_URL="postgresql://kasie:kasie@localhost:5432/kasie" npm run db:migrate
```

For Neon, use your Neon connection string instead. The first migration creates the pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`).

4. **Expose the app publicly.** Slack must reach `https://your-domain/api/slack/events`, so put the web container behind a reverse proxy with TLS (Caddy, nginx, Traefik) and set `APP_URL` in `.env` to that public URL. Then follow [Slack App Setup](2-slack-app-setup.md) and finish at `/onboarding` ([Onboarding](6-onboarding.md)).

## Operating notes

- **Logs:** `docker compose logs -f web` and `docker compose logs -f worker`. Worker startup prints `worker started` with its poll and tick intervals.
- **Upgrades:** pull the new code, `docker compose up -d --build`, and run `npm run db:migrate` if the release includes migrations.
- **Reset (destructive):** `npm run db:fresh` drops the entire `public` schema and re-migrates. Only for throwaway environments; see the warning in [Troubleshooting](16-troubleshooting.md).
- **Backups:** the only state is Postgres. Back up the `kasie_pg` volume (or rely on Neon's branching and backups if you use Neon).
- The worker handles all proactive work in this shape. You do not need to call `/api/cron/heartbeat`, though it remains available and safe to trigger.
