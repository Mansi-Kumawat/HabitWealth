/**
 * GET /api/auth/me - "who am I?" Used by the frontend on every page load to
 * fill the auth context (navbar name, role, profile data).
 */
import { getSessionUser, publicUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Not logged in.", 401);
  return ok(publicUser(user));
}
