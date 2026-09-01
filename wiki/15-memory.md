# Memory

This page is for operators and the curious: how Kasie remembers things, what gets stored where, and what the honest limits are. Kasie's memory is a per-workspace fact store in Postgres, searched by meaning rather than keywords.

## Facts are triples

Every memory is a triple: **entity, relation, target**. Three short strings that read like a sentence:

```
acme-api  deployed_on  vercel
Dana      owns         billing service
conversation  discussed  Q3 launch timeline
```

Triples live in the `kasie_memories` table, and every row carries a `project_id`, so one workspace can never retrieve another workspace's memories.

## Embeddings and pgvector, in plain English

Alongside the text, each triple stores an **embedding**: a list of 1,536 numbers that captures the meaning of the text, produced by an embedding model. Texts with similar meaning get nearby number lists, so "who owns billing?" lands close to "Dana owns billing service" even though the words differ. **pgvector** is the Postgres extension that stores these vectors and finds the nearest ones; **cosine distance** is the closeness measure it uses (the `<=>` operator in the query in `src/lib/embeddings/memory.ts`).

Embeddings are generated through the AI gateway (`embedText` in `src/lib/ai/compat/`), using the model from `EMBEDDING_MODEL` or the default `text-embedding-3-small`. Results are cached in-process by a hash of the text, so repeated phrases are not re-embedded.

Honest caveat: with no AI gateway configured (`AI_GATEWAY_URL` and `AI_GATEWAY_API_KEY` unset), Kasie generates deterministic stub vectors derived from the text length. The pipeline keeps working, which is handy for local poking, but similarity search is meaningless in that mode: retrieval will return essentially arbitrary triples.

## Retrieval: every run, automatically

You never ask Kasie to check its memory; it always does. At the start of every run, the orchestrator (`src/lib/agents/orchestrator.ts`) calls `retrieveMemories(projectId, message, { speakerName })`, which runs two passes: it embeds the incoming message and pulls the top 5 closest triples by cosine distance (dropping anything farther than the `MEMORY_RELEVANCE_MAX_DISTANCE` cutoff of 0.6, so unrelated facts stop leaking into prompts), and when the speaker is known (Slack messages carry the resolved display name) it also pulls the most recent facts whose entity matches `person:<name>`. The two lists are deduped and `formatMemoriesForPrompt` injects them into the model prompt as:

```
Relevant team memory:
- person:dana prefers short bullet summaries
- acme-api deployed_on vercel
```

The model sees these as context alongside the message. There is no keyword index and no manual lookup step. Retrieval is automatic rather than a tool the model chooses to invoke.

## How memories get written

Three writers exist today:

1. **Auto-store after conversations.** When a normal run completes, the orchestrator stores one triple: `conversation discussed <first 200 characters of the message>`. Cheap and lossy, but it gives future retrieval a trail of what came up.

2. **The `remember` tool.** The agent has a first-class tool for storing durable facts (ownership, preferences, decisions, deadlines) as triples, and its prompt tells it to use `person:<name>` entities for facts about people. The model decides when a fact is worth keeping; the write goes straight to `kasie_memories` without approval, since it is an internal database write with no external side effects.

3. **Integration discovery.** When you connect an app, the discovery pass stores 5 to 12 triples about what it found (repos, monitors, projects; see [Integrations](12-integrations.md)). This is why Kasie knows your repo names right after you connect GitHub.

Writes dedup themselves: `storeMemoryTriple` looks for an existing triple with the same entity and relation whose target is near-identical (cosine distance at or below `MEMORY_DEDUP_MAX_DISTANCE`, 0.15). When it finds one, it refreshes that row (target, embedding, timestamp) instead of inserting a duplicate, so restated facts update in place.

## Browsing and deleting memories

The dashboard has a **Memory** page (`/dashboard/memory`) that lists stored triples newest-first with pagination, a search box that queries by meaning (embedding similarity), and a per-row "Forget" button. Deletes are recorded as `memory.deleted` audit events.

## What memory is not (yet)

Straight talk about current limits:

- **No editing.** The Memory page lists, searches, and deletes; changing a fact means deleting it and letting the agent (or a conversation) restate it.
- **No expiry.** Dedup keeps restatements from piling up, but facts never age out on their own.
- **Fixed retrieval depth.** Top 5 triples per run (the `limit = 5` default in `retrieveMemories`); the relevance cutoff only filters, it does not go looking deeper.
- **No cross-project sharing.** Isolation is strict by design; there is no org-level shared memory.

## Operator notes

- Memory quality tracks embedding quality: configure the AI gateway before judging retrieval.
- To inspect a workspace's memory: `SELECT entity, relation, target, timestamp FROM kasie_memories WHERE project_id = '<uuid>' ORDER BY timestamp DESC LIMIT 50;`
- To wipe a workspace's memory: `DELETE FROM kasie_memories WHERE project_id = '<uuid>';` (irreversible, embeddings and all).
- Migrations create the pgvector extension automatically; if that fails on your Postgres, see [Troubleshooting](16-troubleshooting.md).
