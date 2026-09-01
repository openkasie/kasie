# Integrations

This page is for operators connecting Kasie to external apps (GitHub, Datadog, Gmail, and thousands more) and for anyone who wants to know exactly where credentials live. It covers the Pipedream Connect flow, post-connect discovery, tool policies, and visibility.

## How it works, in one paragraph

Kasie does not implement per-app API clients. It uses **Pipedream Connect**, a hosted service that handles the OAuth flow (the "sign in with X and grant access" dance) and stores the resulting credentials, and exposes each connected app's actions to Kasie over **MCP** (Model Context Protocol, an open protocol that lets an AI agent call tools in other apps through a standard interface). Kasie stores only a Pipedream account ID per connection; the actual tokens for GitHub, Gmail, and the rest never touch Kasie's database.

Requires three env vars: `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID` (see [Environment Variables](7-environment-variables.md)). Without them the integrations page still renders but connecting is disabled and the API returns `503 pipedream not configured`.

## The catalog is discovered, not hardcoded

The app list on the integrations dashboard comes live from Pipedream's API (`src/lib/pipedream/discover-apps.ts`): the default view fetches up to 60 apps sorted by Pipedream's `featured_weight`, and the search box queries the full directory of 2,000+ apps. Results are cached in-process for 5 minutes. There is no fixed list in the codebase to maintain.

## The connect flow

From the dashboard integrations page, per `src/app/dashboard/(workspace)/integrations/`:

1. You pick an app and choose **visibility**: workspace (anyone in the project can use it) or private (only you).
2. Kasie creates a **pending** row in the `kasie_integrations` table and the browser fetches a short-lived Connect token from `POST /api/pipedream/connect-token`.
3. The modal embeds Pipedream's OAuth iframe using that token. You authorize the app there, on Pipedream's page, so your password and tokens go to Pipedream, not Kasie.
4. On success, `completeIntegrationAction` stores the Pipedream `accountId` on the row and flips its status to `connected`. (A server-side fallback exists too: Pipedream posts `CONNECTION_SUCCESS` to `POST /api/pipedream/webhook`, which completes the row by account. That path needs `APP_URL` set so the webhook URL can be registered.)
5. Discovery is enqueued in the background (next section).

Each connection has a nickname (defaults like "GitHub account", "GitHub account 2"), so one workspace can hold multiple accounts of the same app.

## Post-connect discovery

Right after connecting, Kasie runs a discovery pass (`src/lib/integrations/discovery.ts`) as a background run:

1. It opens an MCP session for the new integration and lists the available tools.
2. It runs a couple of **read-only probes**. `src/lib/integrations/probes.ts` has curated probe plans for `github` (current user, repos), `datadog` (monitors), `vercel` (projects), `neon` (projects), `gmail` (labels), and `google_sheets` (spreadsheets). For any other app it picks up to two tools whose names look read-only (list, get, search, and similar) and calls those.
3. If an AI gateway is configured, a model turns the probe results into a short summary, a follow-up message, and 5 to 12 entity/relation/target facts.
4. Those facts are stored as memory triples in `kasie_memories` (see [Memory](15-memory.md)), so the agent immediately knows things like which repos exist.
5. The person who connected gets a Slack DM with the summary and "try asking me" examples. Discovery status (`pending`, `running`, `completed`, `failed`) is visible on the integration page, and you can re-run discovery from there.

## Tool policies: auto, approval, disabled

Every tool exposed by an integration has a policy, stored per tool in `kasie_integrations.tool_policies`:

| Policy | Meaning |
|---|---|
| `auto` | The agent may call the tool without asking. |
| `approval` | The call is held as a pending action; a person must approve it in Slack before it executes. This is HITL: human-in-the-loop. |
| `disabled` | The tool is never offered to the agent. |

Defaults are conservative: tools classified as **write** (they change data somewhere) default to `approval`, and **read** tools default to `auto` (`src/lib/mcp/classify-tool.ts` classifies by name). You can override any tool's policy on its integration page. Approvals arrive as Slack buttons; approving executes the tool and resumes the run, rejecting cancels the action.

## Visibility: workspace vs private

Visibility controls whose Pipedream identity holds the connection (`src/lib/pipedream/external-user-id.ts`):

- **workspace**: the connection belongs to the project. Anyone in the workspace can use it through Kasie.
- **private**: the connection is keyed to project plus user. Only runs initiated by that user can load its tools.

You can rename, toggle visibility, disable, or disconnect an integration on its dashboard page. Disconnecting deletes the row in Kasie; revoke the underlying grant in the external app or Pipedream if you want it fully dead.

## Where credentials actually live

- **External app credentials** (GitHub tokens, Google grants, and so on): in Pipedream's vault, never in Kasie. Kasie stores the app slug, nickname, visibility, policies, and the Pipedream `account_id`. Tool calls go server-side to Pipedream's MCP endpoint (`https://remote.mcp.pipedream.net/v3`) authenticated with Kasie's Pipedream project credentials; nothing sensitive reaches the browser.
- **The Slack bot token** is the one credential Kasie itself holds. It lives in the `encrypted_credentials_ref` column of the Slack row in `kasie_integrations`. Honest status: `src/lib/db/vault.ts` implements AES-256-GCM encryption (a strong authenticated cipher) keyed by `ENCRYPTION_KEY`, but the current code path that stores the bot token does not call it yet, so the token is stored as-is despite the column name. Until the vault is wired in, treat database access as bot-token access: lock down `DATABASE_URL` and use per-environment databases. Setting `ENCRYPTION_KEY` (64 hex characters, `openssl rand -hex 32`) is still recommended so the wiring lands without a re-key.

## Troubleshooting pointers

Connect button disabled or `503` from the token endpoint means Pipedream env vars are missing; discovery stuck in `pending` usually means no worker or heartbeat is processing background runs. Details in [Troubleshooting](16-troubleshooting.md).
