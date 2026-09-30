/**
 * AUTHENTICATION HELPERS
 * ======================
 * TWO CONCEPTS INTRODUCED HERE
 *
 * 1. PASSWORD HASHING (bcrypt)
 *    We NEVER store real passwords. bcrypt turns "MySecret@123" into a long
 *    scrambled string like "$2a$10$N9qo8uLO...". It is a ONE-WAY function:
 *    you can check a password against the hash, but you cannot turn the hash
 *    back into the password. If the database ever leaks, attackers still
 *    don't know anyone's password.
 *
 * 2. JSON WEB TOKENS (JWT)
 *    After login the server gives the browser a signed token (a string like
 *    "eyJhbGci..."). The browser sends it back with every request inside an
 *    httpOnly COOKIE (a small piece of storage JavaScript can't read, which
 *    protects it from XSS attacks). The server verifies the token's
 *    signature to know WHO is asking, without hitting "login" again.
 *    Signing uses our JWT_SECRET from .env - anyone without the secret who
 *    tries to forge a token gets an invalid signature.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "fht_session";
const SESSION_DAYS = 7;

/**
 * The key used to sign JWTs. In production you MUST set JWT_SECRET in the
 * hosting dashboard (never commit it). For local development only, we fall
 * back to a fixed string so the app still runs if the .env file is missing
 * on a fresh machine - that fallback is public knowledge, so any token it
 * signs is forgeable: fine for learning, NEVER acceptable in production.
 */
const DEV_ONLY_FALLBACK_SECRET =
  "habitwealth-dev-fallback-secret-do-not-use-in-production";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? DEV_ONLY_FALLBACK_SECRET;
  return new TextEncoder().encode(secret);
}

/** Hash a plain-text password for storing in the database. */
export async function hashPassword(plainPassword: string): Promise<string> {
  // "10" is the cost factor: higher = slower = harder to brute-force.
  return bcrypt.hash(plainPassword, 10);
}

/** Check a login attempt against the stored hash. Returns true/false. */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, storedHash);
}

/** Create a signed JWT containing the user's id and role. */
export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ sub: String(user.id), role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

/** Store the token in an httpOnly cookie on the browser. */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript cannot read it -> safer against XSS
    sameSite: "lax", // blocks most cross-site request forgery
    secure: process.env.NODE_ENV === "production", // HTTPS-only in production
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Remove the cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Read + verify the session cookie and load the matching user row.
 * Returns null when logged out, when the token is expired/invalid, or when
 * the account has been deactivated by an admin.
 * EVERY protected API route calls this first - this is our auth middleware.
 */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = Number(payload.sub);
    if (!userId) return null;
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const user = rows[0];
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    // jwtVerify throws on bad signature or expiry - treat as logged out.
    return null;
  }
}

/** Remove fields that must never leave the server. */
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    occupation: user.occupation,
    monthlyIncomeTarget: user.monthlyIncomeTarget,
    monthlySavingsTarget: user.monthlySavingsTarget,
    financialGoalsText: user.financialGoalsText,
    createdAt: user.createdAt,
  };
}
