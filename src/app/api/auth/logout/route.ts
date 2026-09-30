/**
 * POST /api/auth/logout - delete the session cookie.
 */
import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return ok(null, "Logged out. See you soon!");
}
