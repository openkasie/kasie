import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { slackOAuthRedirectUri } from "./redirect-uri";

const SIWS_SCOPES = ["openid", "email", "profile"].join(",");
export type SlackPkce = {
  codeVerifier: string;
  codeChallenge: string;
  nonce: string;
};

export function generateSlackPkce(): SlackPkce {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const nonce = randomBytes(16).toString("base64url");
  return { codeVerifier, codeChallenge, nonce };
}

function slackSignInRedirectUri(origin: string) {
  return slackOAuthRedirectUri(origin);
}

export function slackSignInAuthorizeUrl(input: {
  origin: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    scope: SIWS_SCOPES,
    redirect_uri: slackSignInRedirectUri(input.origin),
    state: input.state,
    nonce: input.nonce,
    response_type: "code",
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://slack.com/openid/connect/authorize?${params.toString()}`;
}

type SlackOpenIdTokenResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  id_token?: string;
};

export type SlackIdTokenClaims = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  teamId?: string;
};

function decodeSlackIdToken(idToken: string): SlackIdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const teamRaw = payload["https://slack.com/team_id"];
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      teamId: typeof teamRaw === "string" ? teamRaw : undefined,
    };
  } catch {
    return null;
  }
}

export async function exchangeSlackSignInCode(input: {
  code: string;
  origin: string;
  codeVerifier: string;
}) {
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    client_secret: env.SLACK_CLIENT_SECRET ?? "",
    code: input.code,
    redirect_uri: slackSignInRedirectUri(input.origin),
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const res = await fetch("https://slack.com/api/openid.connect.token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await res.json()) as SlackOpenIdTokenResponse;
  if (!payload.ok || !payload.id_token) {
    return { error: payload.error ?? "Slack sign-in exchange failed." } as const;
  }
  const claims = decodeSlackIdToken(payload.id_token);
  if (!claims?.email) {
    return { error: "Slack did not return an email for this account." } as const;
  }
  return { claims } as const;
}
