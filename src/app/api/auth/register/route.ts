/**
 * POST /api/auth/register - create a new account.
 * Flow: validate input -> check duplicate email -> hash password -> insert
 * user -> log them in immediately (set cookie) -> return safe user object.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSessionToken,
  hashPassword,
  publicUser,
  setSessionCookie,
} from "@/lib/auth";
import { checkRateLimit, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Rate limit: max 10 register attempts per IP per 10 minutes. This makes
  // scripted abuse (creating thousands of accounts) slow and useless.
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`register:${ip}`)) {
    return fail("Too many attempts. Please wait a few minutes.", 429);
  }

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // ----- validation with helpful, specific messages -----
  if (name.length < 2) return fail("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail("Please enter a valid email address.");
  if (password.length < 8)
    return fail("Password must be at least 8 characters long.");

  // ----- duplicate email check -----
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return fail("An account with this email already exists. Try logging in.", 409);
  }

  // ----- hash the password and insert -----
  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ name, email, passwordHash, role: "user" })
    .returning();
  const user = inserted[0];

  // Log the new user in straight away so they land on the dashboard.
  await setSessionCookie(await createSessionToken(user));
  return ok(publicUser(user), "Welcome! Your account is ready.", 201);
}
