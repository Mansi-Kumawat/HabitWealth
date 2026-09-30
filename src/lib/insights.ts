/**
 * MOTIVATIONAL INSIGHTS - simple RULE-BASED messages. NO AI involved.
 * ==================================================================
 * Each rule below is a plain function: it looks at a few statistics and
 * either returns ONE friendly sentence or returns null ("rule doesn't apply
 * right now"). The dashboard collects the non-null results and shows the
 * top few. To add your own insight, just copy an existing rule.
 *
 * Keeping every rule in ONE file means you can read the whole "brain" of the
 * feature in two minutes.
 */

import { formatMoney } from "./currency";
import { CURRENCY_SYMBOL } from "./currency";

/** All the numbers the rules are allowed to look at. */
export interface InsightStats {
  monthIncome: number;
  monthExpense: number;
  savingsRate: number; // 0-100
  lastMonthExpense: number;
  topSavingsTarget: number;
  monthSavingsTarget: number;
  bestStreak: number; // highest current streak across habits
  bestStreakHabitName: string;
  habitsDueToday: number;
  netWorthChangeVsLastMonth: number | null; // in currency
  biggestExpenseCategory: string;
  biggestExpenseCategoryShare: number; // 0-100
  categoryChange: { category: string; changePercent: number } | null;
}

/** Every rule returns a sentence or null. Order = priority. */
const rules: Array<(s: InsightStats) => string | null> = [
  // 1. Celebrate a good savings rate.
  (s) =>
    s.savingsRate >= 20
      ? `You saved ${s.savingsRate}% of your income this month - great job! That's better than the 20% rule of thumb.`
      : null,

  // 2. Encourage when saving something, nudge when negative.
  (s) =>
    s.monthIncome > 0 && s.savingsRate > 0 && s.savingsRate < 20
      ? `You saved ${s.savingsRate}% of your income this month. Small steps count - try nudging it towards 20%.`
      : null,
  (s) =>
    s.monthIncome > 0 && s.savingsRate <= 0
      ? `You've spent more than you earned this month. Check your top category (${s.biggestExpenseCategory}) for one thing to trim.`
      : null,

  // 3. Cheer a strong habit streak.
  (s) =>
    s.bestStreak >= 7
      ? `${s.bestStreak}-period streak on "${s.bestStreakHabitName}" - consistency is how wealth is built!`
      : s.bestStreak >= 3
        ? `${s.bestStreak} in a row on "${s.bestStreakHabitName}". Don't break the chain!`
        : null,

  // 4. Remind about today's pending habits.
  (s) =>
    s.habitsDueToday > 0
      ? `${s.habitsDueToday} habit${s.habitsDueToday > 1 ? "s are" : " is"} still waiting for you today. Two minutes now keeps the streak alive.`
      : null,

  // 5. Net worth movement.
  (s) =>
    s.netWorthChangeVsLastMonth !== null && s.netWorthChangeVsLastMonth > 0
      ? `Your net worth grew by ${formatMoney(s.netWorthChangeVsLastMonth)} vs last month. Compounding in action.`
      : s.netWorthChangeVsLastMonth !== null && s.netWorthChangeVsLastMonth < 0
        ? `Net worth dipped by ${formatMoney(Math.abs(s.netWorthChangeVsLastMonth))} vs last month - one heavy month doesn't break a long-term plan.`
        : null,

  // 6. Category shape changes (e.g. food spending up 18%).
  (s) =>
    s.categoryChange && s.categoryChange.changePercent >= 15
      ? `Your ${s.categoryChange.category} spending is up ${Math.round(s.categoryChange.changePercent)}% vs last month - worth a quick look.`
      : null,

  // 7. Warn when one category eats too much.
  (s) =>
    s.biggestExpenseCategoryShare >= 40
      ? `${s.biggestExpenseCategory} makes up ${Math.round(s.biggestExpenseCategoryShare)}% of this month's spending. Variety in cutting is easier than cutting one thing entirely.`
      : null,

  // 8. Fallback so the card is never empty.
  (s) =>
    s.monthIncome === 0 && s.monthExpense === 0
      ? `Start by logging today's expenses - awareness is the first financial habit.`
      : `Every rupee you track is a vote for your future self. Keep going!`,
];

/** Run all rules and return the first messages that apply (max `limit`). */
export function buildInsights(stats: InsightStats, limit = 3): string[] {
  const messages: string[] = [];
  for (const rule of rules) {
    const message = rule(stats);
    if (message) messages.push(message);
    if (messages.length >= limit) break;
  }
  return messages;
}

/** Re-export symbol so rules can mention ₹ without importing twice. */
export { CURRENCY_SYMBOL };
