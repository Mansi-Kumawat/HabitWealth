/**
 * /api/habits
 * GET  - returns the user's habits ENRICHED with computed streak data:
 *        done this period? current streak, longest streak, 30-day history.
 *        Streaks are NOT stored in the database - they are always CALCULATED
 *        from habit_logs, so they can never get out of sync with the logs.
 * POST - create a habit (or add one of the preset templates in one click).
 */
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { fail, isDenied, ok, requireUser, validateText } from "@/lib/api";
import {
  computeStreaks,
  completionRate,
  isDoneThisPeriod,
  round2,
} from "@/lib/finance";
import { currentPeriodKey, dateKeysBack, todayKey } from "@/lib/dates";
import type { Frequency } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Preset templates a user can add with one click (Habit page shows these). */
export const HABIT_PRESETS = [
  { name: "Save ₹100 daily", type: "saving", frequency: "daily", targetAmount: 100 },
  { name: "Log all expenses daily", type: "budgeting", frequency: "daily", targetAmount: null },
  { name: "Invest monthly", type: "investing", frequency: "monthly", targetAmount: 3000 },
  { name: "No-spend day weekly", type: "budgeting", frequency: "weekly", targetAmount: null },
  { name: "Review budget weekly", type: "budgeting", frequency: "weekly", targetAmount: null },
] as const;

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const userHabits = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, auth.id))
    .orderBy(desc(habits.createdAt));

  const logs = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.userId, auth.id))
    .orderBy(desc(habitLogs.loggedDate));

  const last30Days = dateKeysBack(30);

  // Attach computed stats to each habit.
  const enriched = userHabits.map((habit) => {
    const habitPeriodKeys = logs
      .filter((log) => log.habitId === habit.id)
      .map((log) => log.periodKey);
    const frequency = habit.frequency as Frequency;
    const { currentStreak, longestStreak } = computeStreaks(
      habitPeriodKeys,
      frequency
    );
    return {
      ...habit,
      doneThisPeriod: isDoneThisPeriod(habitPeriodKeys, frequency),
      currentStreak,
      longestStreak,
      completionRate30: completionRate(habitPeriodKeys, frequency, 30),
      // For the mini heatmap: which of the last 30 days have a log?
      history30: last30Days.map((day) => ({
        date: day,
        done: logs.some((log) => log.habitId === habit.id && log.loggedDate === day),
      })),
    };
  });

  // "Due today" powers the banner and the notification bell.
  const dueToday = enriched.filter((h) => h.isActive && !h.doneThisPeriod);

  return ok({ habits: enriched, dueToday, presets: HABIT_PRESETS });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const nameError = validateText(body.name, "Habit name", 80);
  if (nameError) return fail(nameError);

  const frequency = ["daily", "weekly", "monthly"].includes(body.frequency)
    ? body.frequency
    : "daily";
  const type = ["saving", "budgeting", "investing", "custom"].includes(body.type)
    ? body.type
    : "custom";

  // Friendly guard: identical habit (same name) already exists?
  const duplicate = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, auth.id));
  if (duplicate.some((h) => h.name.toLowerCase() === String(body.name).trim().toLowerCase())) {
    return fail("You already have a habit with this name.", 409);
  }

  const inserted = await db
    .insert(habits)
    .values({
      userId: auth.id,
      name: String(body.name).trim(),
      type,
      frequency,
      targetAmount:
        body.targetAmount && Number(body.targetAmount) > 0
          ? round2(Number(body.targetAmount))
          : null,
      reminderTime: /^\d{2}:\d{2}$/.test(body.reminderTime ?? "")
        ? body.reminderTime
        : "21:00",
    })
    .returning();

  return ok(inserted[0], "Habit created. Day one starts now!", 201);
}
