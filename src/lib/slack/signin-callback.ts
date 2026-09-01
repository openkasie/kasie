import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createDatabaseSession,
} from "@/lib/auth/db-session";
import { sessionCookieOptions } from "@/lib/auth/session-cookie";
import {
  canSlackSignIn,
  countUsers,
  createUserFromSlack,
  findUserByEmail,
  upsertSlackAccount,
} from "@/lib/db/queries/orgs";
import {
  packBootstrapPending,
  readSignInPending,
  SLACK_BOOTSTRAP_PENDING_COOKIE,
} from "@/lib/slack/bootstrap-state";
import { exchangeSlackSignInCode } from "@/lib/slack/oidc";
import {
  signSlackBotBootstrapState,
  slackOAuthAuthorizeUrl,
} from "@/lib/slack/oauth";

export async function handleSlackSignInCallback(
  request: Request,
  state: string,
  code: string,
) {
  const url = new URL(request.url);
  const fail = (code: string, origin: string) =>
    NextResponse.redirect(new URL(`/onboarding?error=${code}`, origin));

  const pending = readSignInPending(state);
  if (!pending) return fail("slack-signin", url.origin);

  const exchanged = await exchangeSlackSignInCode({
    code,
    origin: pending.origin,
    codeVerifier: pending.codeVerifier,
  });
  if ("error" in exchanged) return fail("slack-signin", pending.origin);

  const { claims } = exchanged;
  const slackEmail = claims.email!.toLowerCase();

  if (pending.mode !== "signin") {
    if (!pending.email) return fail("slack-signin", pending.origin);
    if (slackEmail !== pending.email.toLowerCase()) {
      const params = new URLSearchParams({
        error: "slack-email",
        email: pending.email,
        workspace: pending.workspaceName ?? "",
        channel: pending.channel ?? "",
      });
      return NextResponse.redirect(
        new URL(`/onboarding?${params.toString()}`, pending.origin),
      );
    }
  }

  if (!(await canSlackSignIn(slackEmail))) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invite-only", pending.origin),
    );
  }

  const isBootstrap = (await countUsers()) === 0;
  let user = await findUserByEmail(slackEmail);
  if (!user) {
    if (pending.mode === "signin") {
      return NextResponse.redirect(
        new URL("/sign-in?error=invite-only", pending.origin),
      );
    }
    user = await createUserFromSlack({
      email: slackEmail,
      name: claims.name,
      image: claims.picture,
      isSuperadmin: isBootstrap,
    });
  }

  await upsertSlackAccount({
    userId: user.id,
    slackUserId: claims.sub,
  });

  const { sessionToken } = await createDatabaseSession(user.id);

  if (pending.mode === "signin") {
    const response = NextResponse.redirect(
      new URL("/dashboard", pending.origin),
    );
    applySessionCookie(response, sessionToken);
    return response;
  }

  if (!pending.channel || !pending.workspaceName || !pending.email) {
    return fail("slack-signin", pending.origin);
  }

  const bootstrapPayload = packBootstrapPending({
    channel: pending.channel,
    workspaceName: pending.workspaceName,
    email: pending.email,
    origin: pending.origin,
    userId: user.id,
  });

  const botState = signSlackBotBootstrapState(pending.origin);
  const botUrl = slackOAuthAuthorizeUrl({
    origin: pending.origin,
    state: botState,
    teamId: claims.teamId,
  });

  const response = NextResponse.redirect(botUrl);
  applySessionCookie(response, sessionToken);
  response.cookies.set(
    SLACK_BOOTSTRAP_PENDING_COOKIE,
    bootstrapPayload,
    sessionCookieOptions(600),
  );
  return response;
}
