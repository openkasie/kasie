# Onboarding

This page is for the operator running Kasie's first-run setup and for anyone explaining to teammates how they get in later. It walks through the `/onboarding` wizard phase by phase and describes how sign-in works after setup.

## Before you start

The wizard runs with just `DATABASE_URL`, but you cannot finish it without a Slack app: the final step binds your Kasie workspace to a Slack workspace, which requires `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`. Set those up first via [Slack App Setup](2-slack-app-setup.md). Without them, the connect step shows "Slack app not configured yet" and stops there.

## How you land on the wizard

The root route `/` decides where you go (logic in `src/app/page.tsx`):

- Signed in: redirected to `/dashboard`.
- Not signed in and the `users` table is empty: redirected to `/onboarding`. This is the bootstrap case, a brand new install.
- Not signed in and users exist: redirected to `/sign-in`.

`/onboarding` itself is also guarded (`src/app/onboarding/page.tsx`): if you are not signed in and the install already has users, it sends you to `/sign-in`. A signed-in user who already has a fully connected workspace is sent straight to `/dashboard`.

## The three phases

The wizard (`src/app/onboarding/components/OnboardingWizard.tsx`) runs in one of three phases depending on the state of the install:

### 1. Bootstrap: brand new install, zero users

Four steps: **channel, workspace, email, connect.**

1. **Channel.** Pick where your team talks. Tiles are enabled only for channels whose credentials are configured (`src/app/onboarding/channel-config.ts` checks the `has*OAuth()` helpers from `src/lib/env`). In practice that means Slack; Teams, Google Chat, and Discord are planned ([3](3-teams-app-setup.md), [4](4-google-chat-app-setup.md), [5](5-discord-app-setup.md)).
2. **Workspace.** Name your workspace (2 to 80 characters). This becomes both the organization and the project Kasie works inside.
3. **Email.** Enter your work email. It must be the same email as your Slack account, because Slack verifies it in the next step. This is how the very first user account gets created without any password.
4. **Connect.** Click **Connect Slack**. You will see two Slack prompts in a row:
   - **Sign in with Slack.** An OIDC sign-in (OIDC is OpenID Connect, an identity protocol that returns your verified identity and email). Kasie uses PKCE, a code-exchange hardening standard, in this flow (`src/lib/slack/oidc.ts`). Slack must report the same email you typed in step 3, or you get the "Use the Slack account that matches your work email" error.
   - **Install Kasie to your workspace.** A second OAuth screen that installs the bot with its scopes.

   After both succeed, your user, organization, workspace, and Slack binding all exist, and you land on the dashboard.

### 2. Workspace: signed-in user with no workspace yet

Three steps: **channel, workspace, connect** (no email step, since you are already signed in and your email is known). Submitting the workspace name calls the `createWorkspace` server action (`src/app/onboarding/actions.ts`), which creates the organization and project, then returns you to the wizard in the connect phase.

### 3. Connect: workspace exists but no channel is bound

One step: **connect.** This happens when a workspace was created but Slack was never installed (or you clicked "Skip for now" earlier). The wizard offers **Connect Slack**, plus **Skip for now** to go to the dashboard without a channel. A skipped workspace still works from the dashboard; it just is not reachable from Slack until you come back and connect.

## Error messages you might see

These arrive as `?error=` codes on `/onboarding` and render as a banner:

| Message | Cause |
|---------|-------|
| "That Slack workspace is already bound to another tenant." | One Slack workspace can bind to exactly one Kasie workspace. |
| "Use the Slack account that matches your work email." | The Slack account's verified email did not match the email you entered. |
| "Slack sign-in failed. Try again." | The OIDC exchange with Slack failed; usually transient. |
| "Sign-in did not persist before Slack install. Connect Slack again." | The session cookie was not established between the two Slack prompts; retry the connect step. |

## How later users sign in

After bootstrap, sign-in is **invite-only**: an administrator creates the user record (with an email) first, and only then can that person sign in. There is no self-serve registration and no password.

- The `/sign-in` page offers **Continue with Slack**, plus **Google** and **GitHub** buttons when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are set.
- Google and GitHub run through Auth.js (the library formerly called NextAuth, configured in `src/auth.ts`). The `signIn` callback rejects any OAuth login whose email does not already exist in the `users` table. For known emails, the verified OAuth identity is linked to the existing user record, which is why `allowDangerousEmailAccountLinking` is intentionally enabled: users are pre-provisioned by email, so linking is the designed flow.
- Sessions are database-backed with a 30-day lifetime.

## Testing onboarding again

Two options:

- `npm run db:fresh` drops the `public` schema and re-migrates, giving you a genuinely empty install. **This deletes all data.** It refuses to run when `NODE_ENV=production` unless you pass `-- --force`.
- `/onboarding?preview=1` (development only) renders the bootstrap wizard read-only without touching data, useful for UI work.
