# Agent Guide

Kasie is a self-hostable, multi-tenant AI coworker platform: a Next.js 16 app (plus an optional worker process) backed by Postgres + pgvector. Routes live in `src/app/` as feature modules, business logic in `src/lib/` (queue, memory, Slack, Pipedream, skills, proactive), operator docs in `wiki/`, and deploy manifests in `deploy/` (vercel, docker, ecs, slack). Read this file and `AGENTS-MEMORY.md` at the start of every session.

## Docs-as-code contract

Any change that touches env vars, setup steps, deploy configs, onboarding, integrations, skills, or memory MUST update the matching wiki page in the same change. No follow-up PRs, no "docs later".

| Touched path | Update |
|--------------|--------|
| `src/lib/env/` or `.env.example` | `wiki/7-environment-variables.md` |
| `src/app/onboarding/` | `wiki/6-onboarding.md` |
| `deploy/vercel/` | `wiki/9-deploy-vercel.md` |
| `deploy/docker/` | `wiki/10-deploy-docker.md` |
| `deploy/ecs/` | `wiki/11-deploy-ecs.md` |
| `deploy/slack/` or Slack routes (`src/app/api/slack/`, `src/lib/slack/`) | `wiki/2-slack-app-setup.md` |
| `src/lib/integrations/`, `src/lib/pipedream/`, `src/lib/mcp/` | `wiki/12-integrations.md` |
| `src/lib/skills/` | `wiki/14-skills.md` |
| `src/lib/embeddings/` or memory schema | `wiki/15-memory.md` |
| `src/app/api/` routes | `wiki/13-api-reference.md` |
| Queue, worker, or schema architecture changes | `wiki/8-architecture.md` |

## Memory contract

Read `AGENTS-MEMORY.md` at session start. After any **major** change to architecture, design, or integrations, append a triple entry to the matching section there and update its mermaid graph.

Major means: a service or process added or removed, a schema table added or dropped, a provider or dependency swap, a new integration surface, or a design-system overhaul. Not major: copy tweaks, bugfixes, or refactors that preserve shape.

## Conventions

- `.env.example` is the env source of truth; every variable is validated by `src/lib/env/index.ts`.
- Every database query is scoped by `projectId` (tenant isolation).
- Dashboard writes go through Server Actions, not API routes.
- No Redis: the queue is Postgres (`kasie_queue_jobs`).
- Verify before finishing: `npm run typecheck`, `npm run lint`, `npm test`.

## Git safety

Never create branches, commit, or push without an explicit user request. File edits only.
