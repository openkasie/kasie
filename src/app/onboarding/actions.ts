"use server";

import { redirect } from "next/navigation";
import { createOrgOwner } from "@/lib/db/queries/orgs";
import { createProjectForOrg } from "@/lib/db/queries/projects";
import { requireProjectAccess, requireSession, setSelectedProject } from "@/lib/auth/session";
import { hasSlackOAuth } from "@/lib/env";
import { generateSlackPkce, slackSignInAuthorizeUrl } from "@/lib/slack/oidc";
import { packSignInPending } from "@/lib/slack/bootstrap-state";
import {
  slackOAuthAuthorizeUrl,
  signSlackOAuthState,
} from "@/lib/slack/oauth";
import {
  CreateWorkspaceSchema,
  onboardingInputError,
  OriginSchema,
  ProjectIdSchema,
  SlackOnboardingConnectSchema,
} from "./schemas";

export async function createWorkspace(raw: unknown) {
  const session = await requireSession();
  const parsed = CreateWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: onboardingInputError(parsed.error) };
  }

  const org = await createOrgOwner({
    name: parsed.data.workspaceName,
    userId: session.user.id,
  });
  await createProjectForOrg({
    orgId: org.id,
    name: parsed.data.workspaceName,
    channel: parsed.data.channel,
  });
  redirect("/onboarding");
}

export async function startSlackOnboardingConnect(raw: unknown) {
  const parsed = SlackOnboardingConnectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: onboardingInputError(parsed.error) };
  }
  if (!hasSlackOAuth()) {
    return { ok: false as const, error: "Slack OAuth is not configured." };
  }

  const origin = parsed.data.origin.replace(/\/$/, "");
  const pkce = generateSlackPkce();
  const state = packSignInPending({
    origin,
    email: parsed.data.email.toLowerCase(),
    channel: parsed.data.channel,
    workspaceName: parsed.data.workspaceName,
    codeVerifier: pkce.codeVerifier,
    nonce: pkce.nonce,
    mode: "onboarding",
  });

  redirect(
    slackSignInAuthorizeUrl({
      origin,
      state,
      nonce: pkce.nonce,
      codeChallenge: pkce.codeChallenge,
    }),
  );
}

export async function startSlackOAuth(raw: unknown) {
  const parsed = OriginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: onboardingInputError(parsed.error) };
  }
  await requireProjectAccess(parsed.data.projectId);
  if (!hasSlackOAuth()) {
    return { ok: false as const, error: "Slack OAuth is not configured." };
  }

  const origin = parsed.data.origin.replace(/\/$/, "");
  const state = signSlackOAuthState(parsed.data.projectId, origin);
  redirect(slackOAuthAuthorizeUrl({ origin, state }));
}

export async function skipChannelConnect(raw: unknown) {
  const parsed = ProjectIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: onboardingInputError(parsed.error) };
  }
  await requireProjectAccess(parsed.data.projectId);
  const session = await requireSession();
  await setSelectedProject(session.user.id, parsed.data.projectId);
  redirect("/dashboard");
}
