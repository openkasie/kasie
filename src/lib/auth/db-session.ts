import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { kasieSessions } from "@/lib/db/schema";
import {
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie";

const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export async function createDatabaseSession(userId: string) {
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  await db.insert(kasieSessions).values({
    sessionToken,
    userId,
    expires,
  });
  return { sessionToken, expires };
}

export function applySessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set(
    sessionCookieName(),
    sessionToken,
    sessionCookieOptions(SESSION_MAX_AGE_S),
  );
  return response;
}