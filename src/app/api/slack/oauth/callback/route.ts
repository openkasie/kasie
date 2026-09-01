import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  hasProjectAccess,
  provisionTenant,
  setUserSelectedProject,
} from "@/lib/db/queries/orgs";
import {
  bindProjectPlatformTeam,
  getProjectByTeamId,
  setPrimaryChannel,
  upsertSlackIntegration,
} from "@/lib/db/queries/projects";
import {
  readBootstrapPending,
  readSignInPending,
  SLACK_BOOTSTRAP_PENDING_COOKIE,
} from "@/lib/slack/bootstrap-state";
import {
  exchangeSlackOAuthCode,
  readSlackOAuthState,
} from "@/lib/slack/oauth";
import { adoptInstallerTimezone } from "@/lib/slack/timezone";
import { sendOperatorWelcome } from "@/lib/slack/welcome";
import { handleSlackSignInCallback } from "@/lib/slack/signin-callback";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (code: string, origin: string) =>
    NextResponse.redirect(new URL(`/onboarding?error=${code}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const bootstrapCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SLACK_BOOTSTRAP_PENDING_COOKIE}=`))
    ?.slice(SLACK_BOOTSTRAP_PENDING_COOKIE.length + 1);
  const bootstrap = bootstrapCookie
    ? readBootstrapPending(decodeURIComponent(bootstrapCookie))
    : null;

  const origin = bootstrap?.origin ?? url.origin;

  if (oauthError || !code || !state) return fail("slack", origin);

  if (readSignInPending(state)) {
    return handleSlackSignInCallback(request, state, code);
  }

  const botState = readSlackOAuthState(state);
  if (botState) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(
        new URL("/onboarding?error=slack-session", botState.origin),
      );
    }

    const exchanged = await exchangeSlackOAuthCode(code, botState.origin);
    if ("error" in exchanged) return fail("slack", botState.origin);

    const taken = await getProjectByTeamId(exchanged.teamId);

    if (botState.mode === "bootstrap" && bootstrap) {
      if (bootstrap.userId !== session.user.id) return fail("slack", botState.origin);
      if (taken) return fail("slack-taken", botState.origin);
      if (!exchanged.botToken) return fail("slack", botState.origin);

      const { project } = await provisionTenant({
        userId: session.user.id,
        workspaceName: bootstrap.workspaceName,
        channel: bootstrap.channel,
        slackTeamId: exchanged.teamId,
        botToken: exchanged.botToken,
      });

      await adoptInstallerTimezone(
        project.id,
        exchanged.authedUserId,
        exchanged.botToken,
      );

      await sendOperatorWelcome({
        userId: session.user.id,
        projectId: project.id,
        botToken: exchanged.botToken,
        workspaceName: bootstrap.workspaceName,
        operatorName: session.user.name,
      });

      await setUserSelectedProject(session.user.id, project.id);

      const response = NextResponse.redirect(
        new URL("/dashboard", botState.origin),
      );
      response.cookies.set(SLACK_BOOTSTRAP_PENDING_COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    if (!botState.projectId) return fail("slack", botState.origin);

    if (
      !session.user.isSuperadmin &&
      !(await hasProjectAccess(session.user.id, botState.projectId))
    ) {
      return fail("slack", botState.origin);
    }

    if (taken && taken.id !== botState.projectId) {
      return fail("slack-taken", botState.origin);
    }

    await bindProjectPlatformTeam(botState.projectId, exchanged.teamId);
    await upsertSlackIntegration(
      botState.projectId,
      exchanged.teamId,
      exchanged.botToken,
    );
    await setPrimaryChannel(botState.projectId, "slack");
    await adoptInstallerTimezone(
      botState.projectId,
      exchanged.authedUserId,
      exchanged.botToken,
    );
    await setUserSelectedProject(session.user.id, botState.projectId);

    return NextResponse.redirect(
      new URL("/dashboard", botState.origin),
    );
  }

  return fail("slack", origin);
}
