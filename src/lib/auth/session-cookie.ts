import { env } from "@/lib/env";

/** Match Auth.js cookie naming when the app is served over HTTPS (ngrok, production). */
export function usesSecureSessionCookies() {
  if (env.NODE_ENV === "production") return true;
  return env.APP_URL?.startsWith("https://") ?? false;
}

export function sessionCookieName() {
  return usesSecureSessionCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: usesSecureSessionCookies(),
    maxAge,
  };
}
