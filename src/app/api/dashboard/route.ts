/**
 * GET /api/dashboard - the ONE endpoint behind the Financial Dashboard.
 *
 * WHY ONE COMBINED ENDPOINT? A dashboard needs ~8 different numbers/charts.
 * If the page called 8 small endpoints, that's 8 network round trips, 8
 * loading spinners and 8 chances to fail. Instead the server assembles
 * EVERYTHING here and the page makes exactly one request. Fewer round trips
 * = faster page, especially on mobile networks.
 */
import { db } from "@/db";
import {
  habitLogs,
  habits,
  netWorthSnapshots,
  savingsGoals,
  transactions,
} from "@/db/schema";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { isDenied, ok, requireUser } from "@/lib/api";
import {
  computeStreaks,
  percentage,
  round2,
  savingsRate,
} from "@/lib/finance";
import { buildInsights, type InsightStats } from "@/lib/insights";
import { computeWealthTotals } from "@/lib/wealth";
import {
  monthKeyOf,
  monthKeysBack,
  monthStartKey,
  todayKey,
  type Frequency,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const thisMonth = monthKeyOf(todayKey());
  const last6Months = monthKeysBack(6);

  // ---- 1. Monthly income/expense totals for each of the last 6 months ----
  // Aggregation: GROUP BY month, SUM income & expense in one query.
  const monthlyRows = await db
    .select({
      month: sql<string>`TO_CHAR(${transactions.date}::date, 'YYYY-MM')`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, auth.id),
        gte(transactions.date, monthStartKey(last6Months[0]))
      )
    )
    .groupBy(sql`TO_CHAR(${transactions.date}::date, 'YYYY-MM')`);

  const monthlySeries = last6Months.map((monthKey) => {
    const row = monthlyRows.find((r) => r.month === monthKey);
    return {
      month: monthKey,
      income: round2(Number(row?.income ?? 0)),
      expense: round2(Number(row?.expense ?? 0)),
    };
  });

  const current = monthlySeries[monthlySeries.length - 1];
  const previous = monthlySeries[monthlySeries.length - 2] ?? { income: 0, expense: 0 };

  // ---- 2. This month's expense totals by category (donut chart) ----
  const categoryRows = await db
    .select({
      category: transactions.category,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, auth.id),
        eq(transactions.type, "expense"),
        gte(transactions.date, monthStartKey(thisMonth))
      )
    )
    .groupBy(transactions.category)
    .orderBy(desc(sql`SUM(${transactions.amount})`))
    .limit(8);

  // ---- 3. Habits: due today + best current streak ----
  const userHabits = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, auth.id));
  const userLogs = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.userId, auth.id));

  let bestStreak = 0;
  let bestStreakHabitName = "";
  const habitSummary = userHabits.map((habit) => {
    const keys = userLogs
      .filter((l) => l.habitId === habit.id)
      .map((l) => l.periodKey);
    const streaks = computeStreaks(keys, habit.frequency as Frequency);
    const doneThisPeriod = keys.includes(
      habit.frequency === "daily"
        ? todayKey()
        : computeCurrentKey(habit.frequency as Frequency)
    );
    if (habit.isActive && streaks.currentStreak > bestStreak) {
      bestStreak = streaks.currentStreak;
      bestStreakHabitName = habit.name;
    }
    return {
      id: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      isActive: habit.isActive,
      doneThisPeriod,
      currentStreak: streaks.currentStreak,
    };
  });
  const dueToday = habitSummary.filter((h) => h.isActive && !h.doneThisPeriod);

  // ---- 4. Active savings goals (top 4 for the dashboard widget) ----
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, auth.id))
    .orderBy(asc(savingsGoals.createdAt));

  const goalWidgets = goals
    .filter((g) => g.status === "active")
    .slice(0, 4)
    .map((g) => ({
      id: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      percentComplete: Math.min(100, percentage(g.currentAmount, g.targetAmount)),
    }));

  // ---- 5. Wealth: current totals + snapshot history for the line chart ----
  const totals = await computeWealthTotals(auth.id);
  const snapshots = await db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, auth.id))
    .orderBy(asc(netWorthSnapshots.monthKey));

  const netWorthChangeVsLastMonth =
    snapshots.length >= 2
      ? round2(
          totals.netWorth - Number(snapshots[snapshots.length - 2]?.netWorth ?? 0)
        )
      : null;

  // ---- 6. Recent transactions (latest 5) ----
  const recent = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, auth.id))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(5);

  // ---- 7. Rule-based motivational insights ----
  const stats: InsightStats = {
    monthIncome: current.income,
    monthExpense: current.expense,
    savingsRate: savingsRate(current.income, current.expense),
    lastMonthExpense: previous.expense,
    topSavingsTarget: 0,
    monthSavingsTarget: auth.monthlySavingsTarget ?? 0,
    bestStreak,
    bestStreakHabitName,
    habitsDueToday: dueToday.length,
    netWorthChangeVsLastMonth,
    biggestExpenseCategory: String(categoryRows[0]?.category ?? "Other"),
    biggestExpenseCategoryShare: percentage(
      Number(categoryRows[0]?.total ?? 0),
      current.expense
    ),
    categoryChange: null,
  };

  return ok({
    user: {
      name: auth.name,
      monthlyIncomeTarget: auth.monthlyIncomeTarget,
      monthlySavingsTarget: auth.monthlySavingsTarget,
    },
    stats: {
      monthIncome: current.income,
      monthExpense: current.expense,
      monthSaved: round2(current.income - current.expense),
      savingsRate: stats.savingsRate,
      netWorth: totals.netWorth,
      habitsDoneToday: habitSummary.filter((h) => h.isActive && h.doneThisPeriod).length,
      habitsActiveTotal: habitSummary.filter((h) => h.isActive).length,
    },
    charts: {
      monthlySeries,
      categoryBreakdown: categoryRows.map((c) => ({
        category: c.category,
        total: round2(Number(c.total)),
      })),
      netWorthSeries: snapshots.map((s) => ({
        month: s.monthKey,
        netWorth: s.netWorth,
      })),
    },
    dueToday,
    habitSummary,
    goals: goalWidgets,
    recentTransactions: recent,
    insights: buildInsights(stats),
  });
}

/** Small helper: the current period key for streak "done" checks. */
function computeCurrentKey(frequency: Frequency): string {
  if (frequency === "weekly") {
    // Reuse the same key format the logs were written with.
    const d = new Date();
    const dayNumber = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNumber + 3);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const fd = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fd + 3);
    const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  if (frequency === "monthly") return monthKeyOf(todayKey());
  return todayKey();
}
