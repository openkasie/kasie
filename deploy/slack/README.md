# Slack app manifest

One-command drop-in for operators creating the Kasie Slack app.

## Quick start

1. Deploy Kasie (or start local dev with a static ngrok domain) so Slack can reach your URLs.
2. Generate a manifest for your public origin:

   ```bash
   npm run slack:manifest -- https://your-app.example.com
   ```

   Local dev example:

   ```bash
   npm run slack:manifest -- https://kasie-dev.ngrok-free.app
   ```

3. Open [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**.
4. Pick your workspace, paste the generated YAML, and create the app.
5. Copy **Client ID** and **Client Secret** from **Basic Information** into `.env`:

   ```
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   ```

6. Complete Kasie onboarding at `/onboarding` → **Connect Slack**.

## What the manifest configures

| Setting | URL / value |
|---------|-------------|
| OAuth redirect | `{origin}/api/slack/oauth/callback` |
| Events | `{origin}/api/slack/events` |
| Interactivity | `{origin}/api/slack/interactions` |
| Sign in with Slack | `openid`, `email`, `profile` (user scopes) |
| Bot scopes | See `manifest.yaml` — matches `src/lib/slack/oauth.ts` |

No slash commands. Interaction is via @mentions and DMs.

## Files

| File | Purpose |
|------|---------|
| `manifest.yaml` | Canonical template with `https://your-app.example.com` placeholder |
| `manifest.generated.yaml` | Optional output from `--write` (gitignored if present) |

After creating the app, see [wiki/2-slack-app-setup.md](../../wiki/2-slack-app-setup.md) for troubleshooting and reinstall notes.
