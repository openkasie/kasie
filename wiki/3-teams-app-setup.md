# Microsoft Teams App Setup

This page is for operators asking whether Kasie can connect to Microsoft Teams yet. Short answer: not yet. This page records the current status and what is already reserved for it.

## Status: planned

Slack is the only live channel today (see [Slack App Setup](2-slack-app-setup.md)). Teams appears as a selectable tile on `/onboarding` when its credentials are set, but there is no Teams event handling, bot, or install flow behind it yet. The onboarding wizard is honest about this: picking Teams tells you it is not live and offers Slack instead.

## Reserved configuration

Two environment variables are reserved and already validated in `src/lib/env/index.ts`:

| Variable | Purpose |
|----------|---------|
| `TEAMS_CLIENT_ID` | Azure app registration client ID (future). |
| `TEAMS_CLIENT_SECRET` | Azure app registration client secret (future). |

Setting both enables the Teams tile on `/onboarding` (via `hasTeamsOAuth()`), but there is nothing useful to connect it to today. Leave them unset.

## What shipping Teams will involve

When the channel lands, expect the same shape as Slack:

- An OAuth or app-install flow started from `/onboarding` that binds one Teams tenant to one Kasie workspace.
- A webhook endpoint at `/api/teams/events` receiving message and mention events.
- Signature verification on inbound requests, so only Microsoft can deliver events.
- Thread mapping, so a Teams conversation maps to a Kasie agent thread and replies land in the right place.
- Outbound messaging through the Teams API for replies, approvals, and proactive messages.

Track progress on the project roadmap. Until then, use Slack: the [Onboarding](6-onboarding.md) flow lets a workspace start on Slack today.
