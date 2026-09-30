/**
 * MIDDLEWARE (Next.js concept, same idea as Express middleware)
 * =============================================================
 * This file runs BEFORE the router renders a page. Think of it as the
 * security guard at the building entrance:
 *   - No valid session cookie and you ask for an app page? -> /login
 *   - Already logged in and you ask for /login? -> /dashboard
 *   - Asking for /admin without the "admin" role? -> /dashboard
 *
 * It checks the JWT cryptographically (with the same jose library the API
 * uses) so a fake or expired token never reaches a page. The API routes do
 * their OWN check too - the guard at the door plus a lock on every room.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "fht_session";
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/habits",
  "/goals",
  "/wealth",
  "/profile",
  "/admin",
];
const AUTH_PAGES = ["/login", "/register"];

interface SessionPayload {
  role?: string;
}

// Same dev-only fallback as src/lib/auth.ts (must sign AND verify with the
// same key). Set JWT_SECRET in production - never rely on the fallback there.
const DEV_ONLY_FALLBACK_SECRET =
  "habitwealth-dev-fallback-secret-do-not-use-in-production";

async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? DEV_ONLY_FALLBACK_SECRET
    );
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null; // expired or forged token
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));

  // Not logged in but wants a protected page -> go log in first.
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname); // come back after login
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users don't need the login/register pages.
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Admin area needs the admin ROLE, not just any login.
  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Which URLs run this middleware (static files and API are skipped).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/habits/:path*",
    "/goals/:path*",
    "/wealth/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
