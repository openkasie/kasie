# Kasie Wiki

This is the operator documentation for Kasie. It is written for the person who installs, configures, and runs a Kasie deployment, whether that is a laptop, a Docker host, or a cloud account.

Kasie is a self-hostable, multi-tenant AI coworker. It lives in your team's chat (Slack today, with Microsoft Teams, Google Chat, and Discord planned), runs agent threads with human-in-the-loop approvals (the agent asks a person before doing anything with side effects), keeps workspace-scoped memory in Postgres with pgvector (a Postgres extension that stores embeddings, which are numeric fingerprints of text that let the database find related facts by meaning), and connects to thousands of external apps through Pipedream Connect.

Everything runs from one Next.js codebase plus an optional background worker. The only hard requirement is a Postgres database. There is no Redis: the job queue is Postgres-backed by default.

## Pick your path

- Trying it locally: start with [Getting Started](1-getting-started.md), then [Slack App Setup](2-slack-app-setup.md) if you want real chat.
- Deploying for a team: read [Getting Started](1-getting-started.md) for the basics, then [Deploy on Vercel](9-deploy-vercel.md), [Deploy with Docker](10-deploy-docker.md), or [Deploy on ECS](11-deploy-ecs.md).
- Developing on Kasie: read [Architecture](8-architecture.md) first, then the feature pages ([Integrations](12-integrations.md), [Skills](14-skills.md), [Memory](15-memory.md)).

## All pages

| Page | What it covers |
|------|----------------|
| [0. Index](0-index.md) | This page: what Kasie is and how the wiki is organized. |
| [1. Getting Started](1-getting-started.md) | Minimum requirements and the local quick start, from clone to first run. |
| [2. Slack App Setup](2-slack-app-setup.md) | Creating the Kasie Slack app from the generated manifest, local ngrok tunneling, troubleshooting. |
| [3. Teams App Setup](3-teams-app-setup.md) | Microsoft Teams channel status (planned) and its reserved configuration. |
| [4. Google Chat App Setup](4-google-chat-app-setup.md) | Google Chat channel status (planned) and its reserved configuration. |
| [5. Discord App Setup](5-discord-app-setup.md) | Discord channel status (planned) and its reserved configuration. |
| [6. Onboarding](6-onboarding.md) | The first-run wizard: bootstrap, workspace creation, Slack connect, and how later users sign in. |
| [7. Environment Variables](7-environment-variables.md) | Complete reference for every variable: what it does, when it is required, where to get it. |
| [8. Architecture](8-architecture.md) | How Kasie runs: web app, optional worker, Postgres queue, threads and runs, multi-tenant isolation. |
| [9. Deploy on Vercel](9-deploy-vercel.md) | The serverless path: no long-lived worker, cron-triggered heartbeat. |
| [10. Deploy with Docker](10-deploy-docker.md) | Docker Compose with web, worker, and pgvector Postgres containers. |
| [11. Deploy on ECS](11-deploy-ecs.md) | AWS ECS Fargate deployment and where SQS fits. |
| [12. Integrations](12-integrations.md) | Connecting external apps through Pipedream Connect, tool policies, and post-connect discovery. |
| [13. API Reference](13-api-reference.md) | The HTTP endpoints that exist today: agent runs, cron heartbeat, Slack events, Pipedream routes, auth. |
| [14. Skills](14-skills.md) | What skills actually are (prompt presets), the built-in catalog, and how enabling one changes behavior. |
| [15. Memory](15-memory.md) | How workspace memory works: fact triples, embeddings, retrieval, and approvals. |
| [16. Troubleshooting](16-troubleshooting.md) | Common failure modes and how to diagnose them. |

## Conventions in this wiki

- Commands are shown for a POSIX shell and assume you are in the `kasie/` directory.
- File paths like `src/lib/env/index.ts` are relative to the `kasie/` directory.
- "Required" means Kasie refuses to start or a feature refuses to work without it. "Optional" means you get a degraded but honest fallback (for example, stub AI replies when no AI gateway is configured).
