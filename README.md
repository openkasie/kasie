# Kasie

Kasie is a self-hostable, multi-tenant AI coworker that lives in Slack. Mention it or DM it to start an agent run: it pulls context from workspace memory, uses the tools your team has connected, and asks a human for approval before doing anything risky. Every workspace is isolated, every credential stays server-side, and everything runs on infrastructure you control.

Under the hood it is a single Next.js app (plus an optional worker process) backed by Postgres. There is no Redis, no message broker, and no per-provider AI SDK: jobs live in a Postgres-backed queue, memory lives in pgvector, and models are reached through one OpenAI-compatible gateway.

## Highlights

- **Slack-native agent runs**: @mention or DM Kasie to start threaded conversations with full run history
- **Human-in-the-loop approvals**: risky tool calls pause and wait for approval in Slack or the dashboard
- **Graph memory**: facts stored as entity/relation/target triples with pgvector embeddings, scoped per workspace
- **2,000+ integrations**: Pipedream Connect MCP handles OAuth and tool calls; Kasie never holds your passwords
- **Skills**: toggleable prompt presets (release notes, incident triage, standup summaries, and more)
- **Proactive schedules**: cron-driven tasks and an initiative loop that reports without being asked
- **Multi-tenant**: per-workspace isolation, credentials, usage tracking, and budgets
- **Self-hostable**: one codebase deploys to Vercel, Docker Compose, or ECS Fargate

## Requirements

- Node.js 22+
- Postgres with the pgvector extension ([Neon](https://neon.tech) recommended; the client is the Neon HTTP driver)
- One environment variable to boot: `DATABASE_URL`

Slack, AI gateway, and Pipedream credentials unlock the full experience; without them you get the dashboard and stub AI replies. See [Environment Variables](wiki/7-environment-variables.md).

## Quick start

```bash
cp .env.example .env   # set DATABASE_URL
npm install
npm run db:migrate
npm run dev
```

Open the app and complete onboarding. Full walkthrough: [Getting Started](wiki/1-getting-started.md).

## Deploy

| Target | Notes | Guide |
|--------|-------|-------|
| Vercel | Web only; cron heartbeat drives scheduled work | [wiki/9-deploy-vercel.md](wiki/9-deploy-vercel.md) |
| Docker Compose | Web + worker + pgvector containers | [wiki/10-deploy-docker.md](wiki/10-deploy-docker.md) |
| ECS Fargate | Web + worker from one image | [wiki/11-deploy-ecs.md](wiki/11-deploy-ecs.md) |

## Documentation

Operator docs live in [`wiki/`](wiki/0-index.md):

| Page | Covers |
|------|--------|
| [Getting Started](wiki/1-getting-started.md) | Local setup, what each env key unlocks |
| [Slack App Setup](wiki/2-slack-app-setup.md) | Manifest, scopes, local tunnel |
| [Onboarding](wiki/6-onboarding.md) | First-run wizard, invite-only sign-in |
| [Environment Variables](wiki/7-environment-variables.md) | Full reference for every variable |
| [Architecture](wiki/8-architecture.md) | Web + worker, queue, threads/runs, tenancy |
| [Integrations](wiki/12-integrations.md) | Pipedream Connect, tool policies, discovery |
| [API Reference](wiki/13-api-reference.md) | The HTTP surface that exists today |
| [Skills](wiki/14-skills.md) | Prompt presets and how they change behavior |
| [Memory](wiki/15-memory.md) | Triples, embeddings, retrieval, approval flow |
| [Troubleshooting](wiki/16-troubleshooting.md) | Common failure modes and fixes |

## Contributing

Agents and contributors: read [AGENTS.md](AGENTS.md) before making changes. It defines the docs-as-code contract and the agent memory contract.

## License

[MIT](LICENSE)
