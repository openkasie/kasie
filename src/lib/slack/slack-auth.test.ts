import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { packSignedState, readSignedState, signPayload } from "./signing.ts";

const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;

type SlackSignInPending = {
  origin: string;
  email: string;
  channel: string;
  workspaceName: string;
  codeVerifier: string;
  nonce: string;
  t: number;
};

function packSignInPending(data: Omit<SlackSignInPending, "t">) {
  return packSignedState({ ...data, t: Date.now() });
}

function readSignInPending(state: string) {
  const parsed = readSignedState<SlackSignInPending>(state, BOOTSTRAP_TTL_MS);
  if (!parsed?.origin || !parsed.email || !parsed.codeVerifier || !parsed.nonce) {
    return null;
  }
  return parsed;
}

function generateSlackPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const nonce = randomBytes(16).toString("base64url");
  return { codeVerifier, codeChallenge, nonce };
}

function decodeSlackIdToken(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;
  const teamRaw = payload["https://slack.com/team_id"];
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    teamId: typeof teamRaw === "string" ? teamRaw : undefined,
  };
}

test("generateSlackPkce produces verifier and S256 challenge", () => {
  const pkce = generateSlackPkce();
  assert.ok(pkce.codeVerifier.length >= 32);
  assert.ok(pkce.codeChallenge.length >= 32);
  assert.ok(pkce.nonce.length >= 16);
});

test("decodeSlackIdToken extracts email and team", () => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: "U123",
      email: "ada@acme.com",
      name: "Ada",
      "https://slack.com/team_id": "T123",
    }),
  ).toString("base64url");
  const token = `header.${payload}.sig`;
  const claims = decodeSlackIdToken(token);
  assert.equal(claims?.sub, "U123");
  assert.equal(claims?.email, "ada@acme.com");
  assert.equal(claims?.teamId, "T123");
});

test("signed onboarding state round-trips within TTL", () => {
  const packed = packSignInPending({
    origin: "http://localhost:3000",
    email: "ada@acme.com",
    channel: "slack",
    workspaceName: "Acme",
    codeVerifier: "verifier",
    nonce: "nonce",
  });
  const parsed = readSignInPending(packed);
  assert.equal(parsed?.email, "ada@acme.com");
  assert.equal(parsed?.workspaceName, "Acme");
});

test("readSignedState rejects tampered signature", () => {
  const payload = Buffer.from(JSON.stringify({ t: Date.now(), ok: true })).toString(
    "base64url",
  );
  const packed = `${payload}.${signPayload(payload)}`;
  const tampered = `${packed.slice(0, -2)}ff`;
  assert.equal(readSignedState(tampered, 60_000), null);
});

function readSlackOAuthState(state: string) {
  const parsed = readSignedState<{
    origin?: string;
    mode?: string;
    projectId?: string;
  }>(state, BOOTSTRAP_TTL_MS);
  if (!parsed?.origin) return null;
  if (parsed.mode !== "bootstrap" && parsed.mode !== "project") return null;
  return parsed;
}

test("bot oauth state is not treated as sign-in pending", () => {
  const botState = packSignedState({
    origin: "http://localhost:3000",
    mode: "bootstrap",
    t: Date.now(),
  });
  assert.equal(readSignInPending(botState), null);
});

test("sign-in pending state is not treated as bot oauth", () => {
  const signInState = packSignInPending({
    origin: "http://localhost:3000",
    email: "ada@acme.com",
    channel: "slack",
    workspaceName: "Acme",
    codeVerifier: "verifier",
    nonce: "nonce",
    mode: "onboarding",
  });
  assert.equal(readSlackOAuthState(signInState), null);
});
