/**
 * GET /api/admin/analytics - admin-only platform KPIs:
 *   total users, new users this month, DAU/WAU/MAU (active = logged a
 *   transaction or completed a habit in the window), total transactions,
 *   habits completed today, habit completion rate, average goal completion,
 *   engagement rate, and monthly activity for the last 6 months.
 *
 * Add ?format=csv to download the monthly activity table as a CSV report.
 */
import { db } from "@/db";
import {
  feedback,
  goalContributions,
  habitLogs,
  savingsGoals,
  transactions,
  users,
} from "@/db/schema";
import { gte, sql } from "drizzle-orm";
import { isDenied, ok, requireAdmin } from "@/lib/api";
import { percentage, round2 } from "@/lib/finance";
import { monthKeysBack, monthStartKey, todayKey, toDateKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Run a "SELECT COUNT(*)" style query and return a plain number. */
async function countRows(query: Promise<Array<Record<string, unknown>>>): Promise<number> {
  const rows = (await query) as Array<{ value: number | string }>;
  return Number(rows[0]?.value ?? 0);
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const totalUsers = await countRows(
    db.select({ value: sql<number>`COUNT(*)` }).from(users)
  );
  const newUsersThisMonth = await countRows(
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(users)
      .where(gte(users.createdAt, new Date(toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)))))
  );
  const totalTransactions = await countRows(
    db.select({ value: sql<number>`COUNT(*)` }).from(transactions)
  );
  const habitsCompletedToday = await countRows(
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(habitLogs)
      .where(gte(habitLogs.loggedDate, todayKey()))
  );
  const openTickets = await countRows(
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(feedback)
      .where(sql`${feedback.status} != 'resolved'`)
  );

  // DAU/WAU/MAU: DISTINCT users with any activity (transaction OR habit log
  // OR goal contribution) inside the time window.
  // NOTE: db.execute returns a node-postgres QueryResult, whose `.rows`
  // property is the array of result rows we want.
  async function activeUsersSince(since: Date): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) AS value FROM (
        SELECT user_id FROM transactions WHERE created_at >= ${since}
        UNION
        SELECT user_id FROM habit_logs WHERE created_at >= ${since}
        UNION
        SELECT user_id FROM goal_contributions WHERE created_at >= ${since}
      ) AS active_users
    `);
    return Number((result.rows[0] as { value: string })?.value ?? 0);
  }
  const dau = await activeUsersSince(dayAgo);
  const wau = await activeUsersSince(weekAgo);
  const mau = await activeUsersSince(monthAgo);

  // Habit completion rate = completed periods / expected periods this month.
  // Expected = every active daily habit * days so far (a simple approximation
  // that keeps the maths readable for learners).
  const completionsThisMonth = await countRows(
    db
      .select({ value: sql<number>`COUNT(*)` })
      .from(habitLogs)
      .where(gte(habitLogs.createdAt, new Date(now.getFullYear(), now.getMonth(), 1)))
  );
  const dailyHabitsResult = await db.execute(
    sql`SELECT COUNT(*) AS value FROM habits WHERE is_active = true AND frequency = 'daily'`
  );
  const activeDailyHabits = Number(
    (dailyHabitsResult.rows[0] as { value: string })?.value ?? 0
  );
  const dayOfMonth = now.getDate();
  const habitCompletionRate = percentage(
    completionsThisMonth,
    Math.max(1, activeDailyHabits * dayOfMonth)
  );

  // Average goal completion = mean of (current / target) across all goals.
  const [goalRow] = await db
    .select({
      value: sql<number>`COALESCE(AVG(LEAST(${savingsGoals.currentAmount} / NULLIF(${savingsGoals.targetAmount}, 0), 1)), 0)`,
    })
    .from(savingsGoals);
  const avgGoalCompletion = percentage(Number(goalRow?.value ?? 0), 1);

  // Engagement rate = WAU / total users (are people coming back weekly?).
  const engagementRate = percentage(wau, totalUsers);

  // Monthly activity for the last 6 months (chart + CSV report).
  const sixMonths = monthKeysBack(6);
  const activityRows = await db
    .select({
      month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(gte(transactions.createdAt, new Date(monthStartKey(sixMonths[0]))))
    .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);
  const monthlyActivity = sixMonths.map((m) => ({
    month: m,
    transactions: Number(activityRows.find((r) => r.month === m)?.count ?? 0),
  }));

  // ---- CSV download option ----
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const header = "Month,Transactions Logged";
    const lines = monthlyActivity.map((m) => `${m.month},${m.transactions}`);
    const csv = [header, ...lines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="platform-activity.csv"',
      },
    });
  }

  return ok({
    totalUsers,
    newUsersThisMonth,
    totalTransactions,
    habitsCompletedToday,
    openTickets,
    dau,
    wau,
    mau,
    habitCompletionRate,
    avgGoalCompletion,
    engagementRate,
    monthlyActivity,
  });
}
