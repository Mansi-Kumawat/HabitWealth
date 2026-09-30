/**
 * POST /api/auth/login - verify email + password and start a session.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSessionToken,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`login:${ip}`)) {
    return fail("Too many login attempts. Please wait a few minutes.", 429);
  }

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return fail("Email and password are required.");

  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];

  // IMPORTANT: we use the SAME message for "no such email" and "wrong
  // password". If we told attackers which one was wrong, they could guess
  // which emails have accounts (that's called "user enumeration").
  if (!user) return fail("Invalid email or password.", 401);

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) return fail("Invalid email or password.", 401);

  if (!user.isActive) {
    return fail("This account has been deactivated. Please contact support.", 403);
  }

  await setSessionCookie(await createSessionToken(user));
  return ok(publicUser(user), `Welcome back, ${user.name.split(" ")[0]}!`);
}
