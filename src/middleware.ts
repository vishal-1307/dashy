import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/privacy", "/terms"];

// Middleware runs on the Edge runtime, where Prisma can't execute — this is
// an optimistic cookie-presence check (Better Auth's recommended pattern for
// middleware), not a full session validation. Server components/actions that
// need an authoritative session must call auth.api.getSession() themselves.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon|icons|sw.js|manifest.webmanifest).*)"]
};
