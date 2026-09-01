"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { hasSlackOAuth } from "@/lib/env";
import { packSignInPending } from "@/lib/slack/bootstrap-state";
import { generateSlackPkce, slackSignInAuthorizeUrl } from "@/lib/slack/oidc";
import { resolveAppOrigin } from "@/lib/slack/redirect-uri";

export async function signInWithProvider(provider: "google" | "github") {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signInWithSlack() {
  if (!hasSlackOAuth()) {
    throw new Error("Slack OAuth is not configured.");
  }

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = resolveAppOrigin(`${proto}://${host}`);
  const pkce = generateSlackPkce();
  const state = packSignInPending({
    origin,
    codeVerifier: pkce.codeVerifier,
    nonce: pkce.nonce,
    mode: "signin",
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
