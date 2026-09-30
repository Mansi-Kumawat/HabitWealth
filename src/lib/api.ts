/**
 * SHARED API TOOLKIT
 * ==================
 * Every API route in this app (they live in src/app/api/* /route.ts) returns
 * the SAME JSON shape so the frontend always knows what to expect:
 *
 *   success: { "success": true,  "message": "...", "data": ... }
 *   failure: { "success": false, "message": "what went wrong" }
 *
 * This file also holds two tiny pieces of MIDDLEWARE logic (code that runs
 * before the real route handler):
 *   requireUser  - is anyone logged in?
 *   requireAdmin - is the logged-in user an admin?
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import type { User } from "@/db/schema";

/** Build a success response: { success, message, data }. */
export function ok(data: unknown, message = "OK", status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

/** Build an error response: { success: false, message }. */
export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

/** Either the logged-in user, or a ready-made 401 response. */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await getSessionUser();
  if (!user) return fail("Please log in first.", 401);
  return user;
}

/** Like requireUser, but also demands the "admin" role (else 403). */
export async function requireAdmin(): Promise<User | NextResponse> {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  if (result.role !== "admin") return fail("Admins only.", 403);
  return result;
}

/** Type guard so routes can write: if (denied) return denied; */
export function isDenied(result: User | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

// ---------------------------------------------------------------------------
// TINY VALIDATOR
// Real-world projects use libraries like express-validator or Zod. To keep
// this beginner project dependency-light and readable, we use these three
// explicit checks. The PATTERN is the same as Zod: define rules, get a list
// of human-readable errors back.
// ---------------------------------------------------------------------------

/** Returns an error string, or null when the value is acceptable. */
export function validateAmount(value: unknown, field = "Amount"): string | null {
  const num = Number(value);
  if (value === null || value === undefined || value === "")
    return `${field} is required.`;
  if (!Number.isFinite(num)) return `${field} must be a number.`;
  if (num <= 0) return `${field} must be greater than zero.`;
  if (num > 10_000_000) return `${field} looks too large (max 1 crore).`;
  return null;
}

/** Check a "YYYY-MM-DD" string. Returns an error string or null. */
export function validateDateKey(value: unknown, field = "Date"): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${field} must be in YYYY-MM-DD format.`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return `${field} is not a real date.`;
  return null;
}

/** Check required text input with a length limit. */
export function validateText(
  value: unknown,
  field: string,
  maxLength = 200
): string | null {
  if (typeof value !== "string" || value.trim().length === 0)
    return `${field} is required.`;
  if (value.length > maxLength) return `${field} is too long (max ${maxLength}).`;
  return null;
}

// ---------------------------------------------------------------------------
// TINY RATE LIMITER for the auth routes (login/register).
// It counts attempts per IP inside a sliding time window held in MEMORY.
// Honest limitation for learning: memory resets when the server restarts and
// isn't shared across multiple servers - production apps use Redis instead.
// ---------------------------------------------------------------------------
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 10 * 60 * 1000 // 10 minutes
): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (record.count >= maxAttempts) return false; // blocked
  record.count++;
  return true;
}
