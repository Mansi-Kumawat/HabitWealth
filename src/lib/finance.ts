/**
 * FINANCIAL LOGIC - the maths of the whole app, as small pure functions.
 * "Pure" means: same input -> same output, no database, no Date.now() hidden
 * inside (we PASS today's date in). That makes them trivial to unit test:
 * see tests/finance.test.ts.
 */

import {
  Frequency,
  currentPeriodKey,
  getPeriodKey,
  parseDateKey,
  stepBackOnePeriod,
  toDateKey,
} from "./dates";

/**
 * Round a money number to 2 decimals.
 * WHY: JavaScript floats are binary, so 0.1 + 0.2 === 0.30000000000000004.
 * Multiplying by 100, rounding, dividing back gives clean paise precision for
 * everyday amounts. (Banks avoid floats entirely by storing integer paise.)
 */
export function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * STREAK CALCULATION - the trickiest logic in the app, explained slowly.
 *
 * Input:  a list of period keys from habit_logs (e.g. ["2026-02-09",
 *         "2026-02-10", "2026-02-11"]) and the habit frequency.
 * Output: { currentStreak, longestStreak }
 *
 * currentStreak = how many periods in a row you have completed, ending either
 * in the CURRENT period (already done) or in the PREVIOUS period (not done
 * yet today, but the streak is still alive - you have until the period ends).
 *
 * longestStreak = the best run anywhere in history.
 *
 * Examples (daily habit, today = 2026-02-11):
 *   logs ...09, 10, 11              -> current 3  (done today already)
 *   logs ...09, 10  (no 11 yet)     -> current 2  (still alive!)
 *   logs ...08, 10  (missed 9th)    -> current 1  (chain broke on the 9th)
 *   logs ...05                      -> current 0  (too long ago, broken)
 *
 * The walking trick: we take a date cursor and keep stepping BACK one period
 * (dates.ts handles day/week/month maths incl. month lengths). For each step
 * we ask: "is this period's key in the logs?" Yes -> +1, keep walking.
 * No -> if it's the very first period we checked, the streak is still alive
 * (skip without counting); otherwise the chain is broken, stop.
 */
export function computeStreaks(
  periodKeys: string[],
  frequency: Frequency,
  today: Date = new Date()
): { currentStreak: number; longestStreak: number } {
  // A Set answers "have we logged this period?" in one instant lookup.
  const logged = new Set(periodKeys);
  if (logged.size === 0) return { currentStreak: 0, longestStreak: 0 };

  // ----- current streak: walk backwards from today -----
  let currentStreak = 0;
  let cursor = new Date(today.getTime());
  // If the current period is NOT logged yet, skip it (streak still alive)
  // but do NOT count it. This "grace period" is what makes missed-day
  // handling fair: your streak only breaks AFTER a full period is missed.
  if (!logged.has(getPeriodKey(cursor, frequency))) {
    cursor = stepBackOnePeriod(cursor, frequency);
  }
  // Now count consecutive logged periods going back in time.
  while (logged.has(getPeriodKey(cursor, frequency))) {
    currentStreak++;
    cursor = stepBackOnePeriod(cursor, frequency);
  }

  // ----- longest streak: sort every logged period and find the best run -----
  // Sorting as strings works because our keys are zero-padded (2026-02-09
  // sorts correctly against 2026-02-11, and 2026-W07 against 2026-W12).
  const sortedKeys = [...logged].sort();
  let longestStreak = 0;
  let run = 1;
  for (let i = 1; i < sortedKeys.length; i++) {
    // Is sortedKeys[i] exactly one period after sortedKeys[i-1]?
    // We check by stepping the newer key's date back once and comparing keys.
    const expectedPrev = getPeriodKey(
      stepBackOnePeriod(keyToRepresentativeDate(sortedKeys[i], frequency), frequency),
      frequency
    );
    if (expectedPrev === sortedKeys[i - 1]) {
      run++;
    } else {
      longestStreak = Math.max(longestStreak, run);
      run = 1;
    }
  }
  longestStreak = Math.max(longestStreak, run);

  return { currentStreak, longestStreak };
}

/**
 * Turn any period key into a Date that falls INSIDE that period.
 * We only need "a" date inside the period so getPeriodKey() can re-derive
 * the key after stepping - the exact day/hour doesn't matter.
 */
function keyToRepresentativeDate(key: string, frequency: Frequency): Date {
  if (frequency === "daily") return parseDateKey(key);
  if (frequency === "monthly") return parseDateKey(`${key}-15`); // mid-month
  // weekly "YYYY-Www": ISO week -> approx date = Jan 4 + (week-1)*7 days.
  const [yearPart, weekPart] = key.split("-W");
  const jan4 = new Date(Number(yearPart), 0, 4, 12);
  jan4.setDate(jan4.getDate() + (Number(weekPart) - 1) * 7);
  return jan4;
}

/** True when the habit was completed in the current period. */
export function isDoneThisPeriod(
  periodKeys: string[],
  frequency: Frequency,
  today: Date = new Date()
): boolean {
  return periodKeys.includes(currentPeriodKey(frequency));
}

/** Completion rate over the last `days` days, as a 0-100 percentage.
 *  For weekly habits a full period is 7 days, monthly 30 days. */
export function completionRate(
  periodKeys: string[],
  frequency: Frequency,
  days: 30
): number {
  const periodLength = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 30;
  const periodsInWindow = Math.max(1, Math.round(days / periodLength));
  // Count how many of the last N period keys are logged.
  const cursor = new Date();
  let completed = 0;
  for (let i = 0; i < periodsInWindow; i++) {
    if (periodKeys.includes(getPeriodKey(cursor, frequency))) completed++;
    cursor.setTime(stepBackOnePeriod(cursor, frequency).getTime());
  }
  return round2((completed / periodsInWindow) * 100);
}

/**
 * NET WORTH = savings + investments(current value) + assets - liabilities.
 * THE single most important number in personal finance: what you OWN minus
 * what you OWE. Everything else in the app feeds into this one formula.
 */
export function computeNetWorth(parts: {
  savings: number;
  investments: number;
  assets: number;
  liabilities: number;
}): number {
  return round2(
    parts.savings + parts.investments + parts.assets - parts.liabilities
  );
}

/**
 * SAVINGS RATE = what fraction of income you kept, as a percentage.
 * Example: income Rs 50,000 and expenses Rs 39,000
 *          -> (50000 - 39000) / 50000 * 100 = 22%
 * Guard: with no income we return 0 (dividing by zero would give Infinity).
 */
export function savingsRate(income: number, expense: number): number {
  if (income <= 0) return 0;
  return round2(((income - expense) / income) * 100);
}

/** percentage(25, 200) -> 12.5. Always guards against dividing by zero. */
export function percentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

/** Clamp a number between a min and max, e.g. for progress bars (0-100). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * GOAL PACE - is a goal "on track" or "behind" compared to its deadline?
 * We compare time elapsed vs money saved:
 *   timeProgress   = days elapsed / total days
 *   moneyProgress  = currentAmount / targetAmount
 * If moneyProgress >= 90% of timeProgress we call it "on track", else "behind".
 * Goals without a deadline are always "on-track" (no clock ticking).
 */
export function goalPace(goal: {
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  createdAt: Date;
}): "on-track" | "behind" | "done" {
  if (goal.currentAmount >= goal.targetAmount) return "done";
  if (!goal.deadline) return "on-track";
  const start = goal.createdAt.getTime();
  const end = parseDateKey(goal.deadline).getTime();
  const now = Date.now();
  if (end <= start) return goal.currentAmount >= goal.targetAmount ? "done" : "behind";
  const timeProgress = clamp((now - start) / (end - start), 0, 1);
  const moneyProgress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  return moneyProgress >= timeProgress * 0.9 ? "on-track" : "behind";
}

/**
 * ESTIMATED COMPLETION DATE for a goal.
 * Simple linear forecast: remaining amount / average monthly contribution.
 * Example: Rs 30,000 still to go and you save ~Rs 5,000/month on average
 *          -> about 6 months from today.
 * Returns null when there's not enough history to estimate.
 */
export function estimateGoalCompletion(
  remainingAmount: number,
  monthlyPace: number
): string | null {
  if (remainingAmount <= 0) return "Already reached";
  if (monthlyPace <= 0) return null;
  const monthsNeeded = remainingAmount / monthlyPace;
  const estimate = new Date();
  estimate.setMonth(estimate.getMonth() + Math.ceil(monthsNeeded));
  return toDateKey(estimate);
}
