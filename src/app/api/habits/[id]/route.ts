/**
 * /api/habits/[id] - edit (PUT, includes pause/resume) or remove (DELETE)
 * one habit. Deleting a habit also deletes its completion logs; the history
 * belongs to the habit, not floating around on its own.
 */
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { fail, isDenied, ok, requireUser, validateText } from "@/lib/api";
import { round2 } from "@/lib/finance";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  if (body.name !== undefined) {
    const nameError = validateText(body.name, "Habit name", 80);
    if (nameError) return fail(nameError);
  }

  const updated = await db
    .update(habits)
    .set({
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
      ...(body.targetAmount !== undefined
        ? {
            targetAmount:
              body.targetAmount && Number(body.targetAmount) > 0
                ? round2(Number(body.targetAmount))
                : null,
          }
        : {}),
      ...(body.reminderTime !== undefined ? { reminderTime: body.reminderTime } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    })
    .where(and(eq(habits.id, Number(id)), eq(habits.userId, auth.id)))
    .returning();

  if (updated.length === 0) return fail("Habit not found.", 404);
  return ok(updated[0], body.isActive === false ? "Habit paused." : "Habit updated.");
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;

  const deleted = await db
    .delete(habits)
    .where(and(eq(habits.id, Number(id)), eq(habits.userId, auth.id)))
    .returning();
  if (deleted.length === 0) return fail("Habit not found.", 404);

  await db.delete(habitLogs).where(eq(habitLogs.habitId, Number(id)));
  return ok(null, "Habit and its history deleted.");
}
