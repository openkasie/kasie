# Discord App Setup

This page is for operators asking whether Kasie can connect to Discord yet. Short answer: not yet. This page records the current status and what is already reserved for it.

## Status: planned

Slack is the only live channel today (see [Slack App Setup](2-slack-app-setup.md)). Discord appears as a selectable tile on `/onboarding` when its credentials are set, but there is no Discord event handling, bot, or install flow behind it yet. The onboarding wizard says so and offers Slack instead.

## Reserved configuration

Two environment variables are reserved and already validated in `src/lib/env/index.ts`:

| Variable | Purpose |
|----------|---------|
| `DISCORD_CLIENT_ID` | Discord application client ID (future). |
| `DISCORD_CLIENT_SECRET` | Discord application client secret (future). |

Setting both enables the Discord tile on `/onboarding` (via `hasDiscordOAuth()`), but there is nothing useful to connect it to today. Leave them unset.

## What shipping Discord will involve

When the channel lands, expect the same shape as Slack:

- An OAuth bot-install flow started from `/onboarding` that binds one Discord server to one Kasie workspace.
- A webhook endpoint at `/api/discord/events` receiving message and mention events.
- Signature verification on inbound requests (Discord signs interactions with Ed25519), so only Discord can deliver events.
- Thread mapping, so a Discord channel or thread maps to a Kasie agent thread and replies land in the right place.
- Outbound messaging through the Discord API for replies, approvals, and proactive messages.

Track progress on the project roadmap. Until then, use Slack: the [Onboarding](6-onboarding.md) flow lets a workspace start on Slack today.
