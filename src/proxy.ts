import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fast cookie-presence gate for UX. Real enforcement lives in
// requireSession()/requireProjectAccess(), called by every dashboard
// layout, page, and Server Action.
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSessionCookie ? "/dashboard" : "/sign-in", request.url),
    );
  }

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
