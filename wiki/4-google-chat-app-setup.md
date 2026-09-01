# Google Chat App Setup

This page is for operators asking whether Kasie can connect to Google Chat yet. Short answer: not yet. This page records the current status and what is already reserved for it.

## Status: planned

Slack is the only live channel today (see [Slack App Setup](2-slack-app-setup.md)). Google Chat appears as a selectable tile on `/onboarding` when its credentials are set, but there is no Google Chat event handling, bot, or install flow behind it yet. The onboarding wizard says so and offers Slack instead.

## Reserved configuration

Two environment variables are reserved and already validated in `src/lib/env/index.ts`:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CHAT_CLIENT_ID` | Google Cloud OAuth client ID (future). |
| `GOOGLE_CHAT_CLIENT_SECRET` | Google Cloud OAuth client secret (future). |

Setting both enables the Google Chat tile on `/onboarding` (via `hasGoogleChatOAuth()`), but there is nothing useful to connect it to today. Leave them unset. Note these are separate from `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, which power invite-only Google sign-in and work today.

## What shipping Google Chat will involve

When the channel lands, expect the same shape as Slack:

- An OAuth or app-install flow started from `/onboarding` that binds one Google Workspace to one Kasie workspace.
- A webhook endpoint at `/api/google-chat/events` receiving message and mention events.
- Signature verification on inbound requests, so only Google can deliver events.
- Thread mapping, so a Chat space or thread maps to a Kasie agent thread and replies land in the right place.
- Outbound messaging through the Google Chat API for replies, approvals, and proactive messages.

Track progress on the project roadmap. Until then, use Slack: the [Onboarding](6-onboarding.md) flow lets a workspace start on Slack today.
