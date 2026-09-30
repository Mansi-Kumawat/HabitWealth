/**
 * UNIT TESTS for the pure financial logic (src/lib/finance.ts).
 * ============================================================
 * Run them with:  npx vitest run tests
 *
 * WHAT IS A UNIT TEST? We call one small function with known inputs and
 * assert the output is exactly what we calculated by hand. If someone later
 * "improves" the streak code and breaks the maths, these tests turn red
 * BEFORE the bug reaches users.
 *
 * We test the three trickiest functions: computeStreaks (daily/weekly/monthly
 * chains, missed days, timezone edge), computeNetWorth (the one formula the
 * whole app depends on) and the percentage helpers (dividing by zero!).
 */
import { describe, expect, it } from "vitest";
import {
  computeNetWorth,
  computeStreaks,
  completionRate,
  percentage,
  round2,
  savingsRate,
} from "../src/lib/finance";
import { getISOWeekKey, getPeriodKey, stepBackOnePeriod } from "../src/lib/dates";

/** Build "YYYY-MM-DD" keys for the N days ending at `endDate` (inclusive). */
function dailyKeysEnding(endDate: string, count: number, skip: number[] = []): string[] {
  const keys: string[] = [];
  const end = new Date(`${endDate}T12:00:00`);
  for (let i = 0; i < count + skip.length + 5; i++) {
    if (!skip.includes(i)) {
      const d = new Date(end.getTime());
      d.setDate(end.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    if (keys.length >= count) break;
  }
  return keys;
}

describe("computeStreaks - daily habits", () => {
  const today = new Date("2026-02-11T09:30:00");

  it("counts a chain ending today", () => {
    const keys = ["2026-02-09", "2026-02-10", "2026-02-11"]; // today
    expect(computeStreaks(keys, "daily", today).currentStreak).toBe(3);
  });

  it("keeps the streak alive when today is not logged YET", () => {
    const keys = ["2026-02-09", "2026-02-10"]; // yesterday was last log
    expect(computeStreaks(keys, "daily", today).currentStreak).toBe(2);
  });

  it("breaks the streak when a full day was missed", () => {
    const keys = ["2026-02-08", "2026-02-10"]; // 9th missing!
    expect(computeStreaks(keys, "daily", today).currentStreak).toBe(1);
  });

  it("returns 0 when the last log is too old", () => {
    const keys = ["2026-02-05"];
    expect(computeStreaks(keys, "daily", today).currentStreak).toBe(0);
  });

  it("finds the longest run even when the current streak is broken", () => {
    // 5 in a row, then a gap, then 2 in a row up to yesterday.
    const keys = [
      "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05",
      "2026-02-09", "2026-02-10",
    ];
    const result = computeStreaks(keys, "daily", today);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it("handles a chain crossing a MONTH boundary (Jan 31 -> Feb 1)", () => {
    const keys = ["2026-01-30", "2026-01-31", "2026-02-01"];
    const feb2 = new Date("2026-02-02T08:00:00");
    expect(computeStreaks(keys, "daily", feb2).currentStreak).toBe(3);
  });
});

describe("computeStreaks - weekly and monthly habits", () => {
  it("counts consecutive weeks (ISO week keys)", () => {
    // Three logs: one in each of the last 3 weeks, none this week yet.
    const now = new Date("2026-02-11T12:00:00"); // Wednesday, week 7
    const keys = ["2026-W04", "2026-W05", "2026-W06"];
    const result = computeStreaks(keys, "weekly", now);
    expect(result.currentStreak).toBe(3); // still alive - this week isn't over
  });

  it("breaks when a whole week was skipped", () => {
    const now = new Date("2026-02-11T12:00:00");
    const keys = ["2026-W04", "2026-W06"]; // week 5 skipped
    expect(computeStreaks(keys, "weekly", now).currentStreak).toBe(1);
  });

  it("counts consecutive months", () => {
    const now = new Date("2026-02-11T12:00:00");
    const keys = ["2025-12", "2026-01"]; // done Dec + Jan, Feb pending
    expect(computeStreaks(keys, "monthly", now).currentStreak).toBe(2);
  });

  it("getPeriodKey helpers agree with the streak maths", () => {
    // Two dates in the same ISO week must produce the SAME week key.
    const monday = new Date("2026-02-09T12:00:00");
    const friday = new Date("2026-02-13T12:00:00");
    expect(getISOWeekKey(monday)).toBe(getISOWeekKey(friday));
    // And stepping back 7 days lands in the previous week.
    const stepped = stepBackOnePeriod(friday, "weekly");
    expect(getISOWeekKey(stepped)).not.toBe(getISOWeekKey(friday));
    expect(getPeriodKey(monday, "monthly")).toBe("2026-02");
  });
});

describe("computeNetWorth - the core formula", () => {
  it("sums owned minus owed", () => {
    // savings 50,000 + investments 1,20,000 + assets 2,00,000 - loan 80,000
    const net = computeNetWorth({ savings: 50000, investments: 120000, assets: 200000, liabilities: 80000 });
    expect(net).toBe(290000);
  });

  it("can be negative when debts exceed assets (and that's OK)", () => {
    expect(computeNetWorth({ savings: 5000, investments: 0, assets: 0, liabilities: 20000 })).toBe(-15000);
  });
});

describe("percentage helpers", () => {
  it("computes savings rate with a worked example", () => {
    // income 50,000, expenses 39,000 -> saved 11,000 -> 22%
    expect(savingsRate(50000, 39000)).toBe(22);
  });

  it("returns 0 instead of Infinity when income is zero", () => {
    expect(savingsRate(0, 5000)).toBe(0);
    expect(percentage(10, 0)).toBe(0);
  });

  it("handles negative savings (spent more than earned)", () => {
    expect(savingsRate(40000, 45000)).toBe(-12.5);
  });

  it("percentage() does plain maths", () => {
    expect(percentage(25, 200)).toBe(12.5);
  });
});

describe("round2 - money rounding", () => {
  it("fixes the classic 0.1 + 0.2 floating point problem", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(349.499)).toBe(349.5);
  });
});

describe("completionRate", () => {
  it("counts done days inside the last 30 days", () => {
    const keys = dailyKeysEnding(new Date().toISOString().slice(0, 10), 15);
    const rate = completionRate(keys, "daily", 30);
    expect(rate).toBeGreaterThan(45);
    expect(rate).toBeLessThanOrEqual(55);
  });
});
