import { env } from "@/lib/env";
import { slackOAuthRedirectUri } from "./redirect-uri";
import { packSignedState, readSignedState } from "./signing";

const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "chat:write",
  "groups:history",
  "im:history",
  "im:write",
  "mpim:history",
  "reactions:write",
  "team:read",
  "users:read",
].join(",");

export function slackOAuthAuthorizeUrl(input: {
  origin: string;
  state: string;
  teamId?: string;
}) {
  const redirectUri = slackOAuthRedirectUri(input.origin);
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    scope: SLACK_BOT_SCOPES,
    redirect_uri: redirectUri,
    state: input.state,
  });
  if (input.teamId) params.set("team", input.teamId);
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

type OAuthState = {
  projectId?: string;
  origin: string;
  mode: "project" | "bootstrap";
  t: number;
};

export function signSlackOAuthState(projectId: string, origin: string) {
  return packSignedState({
    projectId,
    origin,
    mode: "project",
    t: Date.now(),
  } satisfies OAuthState);
}

export function signSlackBotBootstrapState(origin: string) {
  return packSignedState({
    origin,
    mode: "bootstrap",
    t: Date.now(),
  } satisfies OAuthState);
}

export function readSlackOAuthState(
  state: string,
): { projectId?: string; origin: string; mode: "project" | "bootstrap" } | null {
  const parsed = readSignedState<OAuthState>(state, 10 * 60 * 1000);
  if (!parsed?.origin) return null;
  if (parsed.mode !== "bootstrap" && parsed.mode !== "project") return null;
  return {
    projectId: parsed.projectId,
    origin: parsed.origin,
    mode: parsed.mode,
  };
}

type SlackOAuthAccess = {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
};

export async function exchangeSlackOAuthCode(code: string, origin: string) {
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    client_secret: env.SLACK_CLIENT_SECRET ?? "",
    code,
    redirect_uri: slackOAuthRedirectUri(origin),
  });
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await res.json()) as SlackOAuthAccess;
  if (!payload.ok || !payload.team?.id) {
    return { error: payload.error ?? "Slack OAuth exchange failed." };
  }
  return {
    teamId: payload.team.id,
    teamName: payload.team.name,
    botToken: payload.access_token,
  };
}
