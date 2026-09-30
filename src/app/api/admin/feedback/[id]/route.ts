/**
 * PUT /api/admin/feedback/[id] - admin-only: change a ticket's status and
 * add/update the admin note (the reply the user sees on their profile page).
 */
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fail, isDenied, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const allowedStatuses = ["open", "in_progress", "resolved"];
  if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
    return fail("Status must be open, in_progress or resolved.");
  }

  const updated = await db
    .update(feedback)
    .set({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.adminNote !== undefined
        ? { adminNote: String(body.adminNote).slice(0, 2000) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(feedback.id, Number(id)))
    .returning();

  if (updated.length === 0) return fail("Ticket not found.", 404);
  return ok(updated[0], "Ticket updated.");
}
