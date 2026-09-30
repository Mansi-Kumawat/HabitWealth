/**
 * POST /api/habits/complete - mark a habit done for the CURRENT period.
 * Body: { habitId }.
 *
 * "One completion per period" is enforced at TWO levels:
 * 1. Here in code - we check for an existing log first (friendly message).
 * 2. In the database - a UNIQUE index on (habitId, periodKey) rejects a
 *    second insert even if two requests race each other (double-click).
 * Belt and suspenders: the code gives the nice message, the index gives the
 * hard guarantee.
 */
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { fail, isDenied, ok, requireUser } from "@/lib/api";
import { currentPeriodKey, todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  const habitId = Number(body?.habitId);
  if (!habitId) return fail("habitId is required.");

  // The habit must exist AND belong to this user.
  const habitRows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, auth.id)));
  const habit = habitRows[0];
  if (!habit) return fail("Habit not found.", 404);

  const periodKey = currentPeriodKey(habit.frequency as "daily" | "weekly" | "monthly");

  const existing = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.periodKey, periodKey)));
  if (existing.length > 0) {
    return fail(`Already completed for this ${habit.frequency} period.`, 409);
  }

  try {
    const inserted = await db
      .insert(habitLogs)
      .values({ habitId, userId: auth.id, periodKey, loggedDate: todayKey() })
      .returning();
    return ok(inserted[0], `Nice! "${habit.name}" done for today. Streak continues.`, 201);
  } catch (error) {
    // Unique index fired (race condition: two clicks at the same time).
    return fail("Already completed for this period.", 409);
  }
}
