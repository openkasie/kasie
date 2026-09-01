import { env } from "@/lib/env";

/** Strip trailing slash so redirect URIs match Slack app config exactly. */
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

/** Shared redirect URI for Sign in with Slack and bot install OAuth. */
export function slackOAuthRedirectUri(origin: string): string {
  return `${normalizeOrigin(origin)}/api/slack/oauth/callback`;
}

/** Prefer APP_URL when set (ngrok / production URL during local OAuth testing). */
export function resolveAppOrigin(fallback: string): string {
  return normalizeOrigin(env.APP_URL ?? fallback);
}
