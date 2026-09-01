# Slack App Setup

This page is for the operator creating the Slack app that Kasie runs behind. It covers generating the app manifest, creating the app, wiring local development through an ngrok tunnel, and fixing the common failure modes.

Slack is the only live channel today. Teams, Google Chat, and Discord are planned; see their stub pages ([3](3-teams-app-setup.md), [4](4-google-chat-app-setup.md), [5](5-discord-app-setup.md)).

## How the pieces fit

Kasie needs one Slack app per deployment. The app gives you a `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`, which unlock two flows:

1. **Sign in with Slack**, an OIDC flow (OIDC is OpenID Connect, an identity layer on top of OAuth that proves who the user is and returns their verified email).
2. **Bot install OAuth**, which installs the Kasie bot into a Slack workspace with the scopes it needs to read mentions and post messages.

Both flows share a single redirect URL, `{origin}/api/slack/oauth/callback` (see `src/lib/slack/redirect-uri.ts`), so only one URL needs to be registered with Slack.

Slack must be able to reach your deployment over public HTTPS. That means either a deployed instance or, for local dev, an ngrok tunnel (below).

## Create the app from the manifest

A Slack app manifest is a YAML file that declares the app's name, scopes, and URLs in one shot, so you never click through settings screens by hand. The canonical template is `deploy/slack/manifest.yaml` with the placeholder `https://your-app.example.com`; the generator substitutes your real origin.

1. Generate the manifest for your public origin:

   ```bash
   npm run slack:manifest -- https://your-app.example.com
   ```

   If `APP_URL` or `NGROK_DOMAIN` is set in `.env`, you can omit the argument. Add `--write manifest.generated.yaml` to write to a file instead of stdout (`scripts/slack-manifest.mjs`).

2. Open [api.slack.com/apps](https://api.slack.com/apps), click **Create New App**, choose **From a manifest**, pick your workspace, and paste the generated YAML.

3. On the app's **Basic Information** page, copy **Client ID** and **Client Secret** into `.env`:

   ```
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   ```

4. Restart Kasie so the new variables load, then finish [Onboarding](6-onboarding.md) at `/onboarding` and click **Connect Slack**.

## What the manifest configures

| Setting | Value |
|---------|-------|
| OAuth redirect URL | `{origin}/api/slack/oauth/callback` |
| Event subscriptions URL | `{origin}/api/slack/events` |
| Interactivity URL | `{origin}/api/slack/interactions` |
| Bot events | `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim` |
| Bot scopes | `app_mentions:read`, `channels:history`, `chat:write`, `reactions:write`, `groups:history`, `im:history`, `im:write`, `mpim:history`, `team:read`, `users:read` |
| User scopes (Sign in with Slack) | `openid`, `email`, `profile` |

There are no slash commands: you talk to Kasie by @mentioning it in a channel or DMing it. Socket Mode and token rotation are both off; events arrive as plain HTTPS POSTs to your deployment.

## Local development with ngrok

ngrok is a tunneling service that gives your local machine a stable public HTTPS URL. Kasie's dev script uses a **static domain** (a reserved ngrok hostname that does not change between restarts) so you do not have to re-edit the Slack app every time you restart.

1. Get an authtoken at [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) and reserve a free static domain at [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) (for example `kasie-dev.ngrok-free.app`).

2. Set both in `.env`:

   ```
   NGROK_AUTHTOKEN=...
   NGROK_DOMAIN=kasie-dev.ngrok-free.app
   ```

3. Run `npm run dev`. When both variables are set, the script starts the tunnel, points it at the dev port, and sets `APP_URL` to the tunnel URL so OAuth redirect URLs resolve correctly. Setting only one of the two is an error, and the script exits.

4. Generate the manifest against the tunnel domain and create (or update) your Slack app with it:

   ```bash
   npm run slack:manifest -- https://kasie-dev.ngrok-free.app
   ```

If port 3000 is busy (Cursor and other tools like to take it), set `DEV_PORT=3002` in `.env`. Next.js and ngrok must share the same port; the script checks this and tells you who owns the port if it is taken.

## Troubleshooting and reinstalling

- **Slack shows "url didn't respond" or events never arrive.** Slack cannot reach your URLs. Confirm the tunnel or deployment is up and that the URLs in your Slack app settings match your current origin exactly. If your origin changed, regenerate the manifest and paste it into the app's **App Manifest** settings page, then reinstall the app to the workspace.
- **ngrok fails with `ERR_NGROK_334` or "already online".** Your static domain is still bound to another ngrok session. Stop it at [dashboard.ngrok.com/agents](https://dashboard.ngrok.com/agents), wait about 30 seconds, and retry.
- **"That Slack workspace is already bound to another tenant."** Kasie is multi-tenant and enforces one Slack workspace per Kasie workspace. Someone already connected this Slack workspace; there is no sharing across tenants.
- **"Use the Slack account that matches your work email."** During onboarding you enter a work email, and the Slack account you sign in with must have the same verified email. Sign in to Slack with the matching account, or restart onboarding with the right email.
- **Changed scopes or URLs?** Update the manifest in the Slack app settings, then reinstall the app to the workspace so Slack issues a token with the new scopes. The bot scope list in the manifest matches what `src/lib/slack/oauth.ts` requests; they must stay in sync.

More general failure modes live in [Troubleshooting](16-troubleshooting.md). The short version of this page also lives next to the manifest in `deploy/slack/README.md`.
