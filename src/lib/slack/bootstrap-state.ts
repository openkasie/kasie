import { packSignedState, readSignedState } from "./signing";

const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;

export type SlackBootstrapPending = {
  channel: string;
  workspaceName: string;
  email: string;
  origin: string;
  userId: string;
  t: number;
};

export type SlackSignInPending = {
  origin: string;
  email?: string;
  channel?: string;
  workspaceName?: string;
  codeVerifier: string;
  nonce: string;
  mode?: "onboarding" | "signin";
  t: number;
};

export function packSignInPending(data: Omit<SlackSignInPending, "t">) {
  return packSignedState({ ...data, t: Date.now() });
}

export function readSignInPending(state: string) {
  const parsed = readSignedState<SlackSignInPending>(state, BOOTSTRAP_TTL_MS);
  if (!parsed?.origin || !parsed.codeVerifier || !parsed.nonce) {
    return null;
  }
  if (parsed.mode === "signin") return parsed;
  if (!parsed.email || !parsed.channel || !parsed.workspaceName) return null;
  return parsed;
}

export function packBootstrapPending(data: Omit<SlackBootstrapPending, "t">) {
  return packSignedState({ ...data, t: Date.now() });
}

export function readBootstrapPending(state: string) {
  return readSignedState<SlackBootstrapPending>(state, BOOTSTRAP_TTL_MS);
}

export const SLACK_BOOTSTRAP_PENDING_COOKIE = "kasie_slack_bootstrap";
