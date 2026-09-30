/**
 * PUT /api/admin/users/[id] - activate or deactivate a user account.
 * Deactivated users can't log in (login + session checks both verify
 * isActive), but their data stays intact in case of mistakes.
 * Safety rails: admins cannot deactivate themselves or other admins.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fail, isDenied, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;
  const { id } = await params;
  const targetId = Number(id);

  const body = await request.json().catch(() => null);
  if (typeof body?.isActive !== "boolean")
    return fail("isActive (boolean) is required.");

  if (targetId === admin.id) return fail("You cannot deactivate your own account.");

  const targetRows = await db.select().from(users).where(eq(users.id, targetId));
  const target = targetRows[0];
  if (!target) return fail("User not found.", 404);
  if (target.role === "admin") return fail("Admin accounts cannot be deactivated.");

  const updated = await db
    .update(users)
    .set({ isActive: body.isActive })
    .where(eq(users.id, targetId))
    .returning();

  return ok(
    { id: updated[0].id, isActive: updated[0].isActive },
    body.isActive ? "User reactivated." : "User deactivated."
  );
}
