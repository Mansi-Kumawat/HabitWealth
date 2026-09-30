/**
 * DATE HELPERS - small, well-tested functions that every streak calculation
 * builds on. Dates are the #1 source of bugs in habit trackers, so we keep
 * ALL the tricky logic in this one file.
 *
 * SIMPLE RULES WE FOLLOW
 * 1. A "day" is represented as the string "YYYY-MM-DD" (e.g. "2026-02-11").
 *    Strings can't accidentally shift by timezone the way Date objects can.
 * 2. Streaks don't care about hours - only about which PERIOD (day, ISO week,
 *    or calendar month) a completion happened in.
 * 3. A "period key" is a string that is equal for two dates in the same
 *    period: "2026-02-11" (daily), "2026-W07" (weekly), "2026-02" (monthly).
 */

export type Frequency = "daily" | "weekly" | "monthly";

/** Convert a Date into our canonical "YYYY-MM-DD" string (local timezone). */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-based!
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date key, e.g. "2026-02-11". */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parse a "YYYY-MM-DD" string back into a Date at LOCAL noon.
 *  We use noon (not midnight) so daylight-saving changes can never push the
 *  date into the previous/next day while we do math on it. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * ISO week number (1-53). ISO weeks start on Monday. The clever standard
 * trick: copy the date, move to Thursday of the same week, then the week is
 * "how many Thursdays have passed since the first Thursday of the year".
 * Example: 2026-02-11 (Wed) and 2026-02-13 (Fri) are BOTH in week 7.
 */
export function getISOWeekKey(d: Date): string {
  const date = new Date(d.getTime());
  // Move to Thursday of this week (getDay: Sun=0 ... Sat=6).
  const dayNumber = (date.getDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setDate(date.getDate() - dayNumber + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
  const weekNumber =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

/** The period key for one date given a habit frequency. */
export function getPeriodKey(d: Date, frequency: Frequency): string {
  if (frequency === "daily") return toDateKey(d);
  if (frequency === "weekly") return getISOWeekKey(d);
  // monthly: "YYYY-MM"
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

/** The period key for "right now". */
export function currentPeriodKey(frequency: Frequency): string {
  return getPeriodKey(new Date(), frequency);
}

/**
 * Move a date cursor back by exactly one period:
 *   daily   -> minus 1 day
 *   weekly  -> minus 7 days (same weekday last week = same ISO week - 1)
 *   monthly -> minus 1 month (we jump to the 1st first to avoid the
 *              "Jan 31 minus 1 month = Mar 3" overflow trap)
 * Combined with getPeriodKey(), this lets us walk backwards period by period.
 */
export function stepBackOnePeriod(cursor: Date, frequency: Frequency): Date {
  const next = new Date(cursor.getTime());
  if (frequency === "daily") {
    next.setDate(next.getDate() - 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() - 7);
  } else {
    next.setDate(1); // pin to the 1st so month math can never overflow
    next.setMonth(next.getMonth() - 1);
  }
  return next;
}

/** First day of a month ("2026-02") as a date key ("2026-02-01"). */
export function monthStartKey(monthKey: string): string {
  return `${monthKey}-01`;
}

/** Last day of a month: take the 1st of NEXT month and subtract a day. */
export function monthEndKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const firstOfNextMonth = new Date(year, month, 1, 12); // JS months 0-based
  firstOfNextMonth.setDate(firstOfNextMonth.getDate() - 1);
  return toDateKey(firstOfNextMonth);
}

/** The month key ("YYYY-MM") for a date key ("YYYY-MM-DD"). */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** List of the last N month keys ending at the current month,
 *  e.g. monthKeysBack(3) -> ["2025-12", "2026-01", "2026-02"]. */
export function monthKeysBack(count: number): string[] {
  const keys: string[] = [];
  const cursor = new Date();
  cursor.setDate(1); // pin to 1st to avoid month-overflow
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1, 12);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** List of the last N date keys (including today), oldest first. */
export function dateKeysBack(count: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setDate(today.getDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}
