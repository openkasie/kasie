import { createHmac, timingSafeEqual } from "node:crypto";
function slackSigningKey() {
  return (
    process.env.AUTH_SECRET ??
    process.env.SLACK_CLIENT_SECRET ??
    "dev-slack-oauth"
  );
}

export function signPayload(payload: string) {
  return createHmac("sha256", slackSigningKey()).update(payload).digest("hex");
}

export function packSignedState(data: unknown) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function readSignedState<T>(state: string, maxAgeMs: number): T | null {
  const lastDot = state.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payload = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  const expected = signPayload(payload);
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as T & { t?: number };
    if (!parsed.t || Date.now() - parsed.t > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}
