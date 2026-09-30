/**
 * GET /api/transactions/summary?month=YYYY-MM
 * The numbers behind the Expense Tracker's "monthly report" section:
 * totals, savings rate, top 3 categories, donut data, and a comparison with
 * the previous month.
 *
 * ⭐ AGGREGATION EXPLAINED IN SIMPLE WORDS ⭐
 * An aggregation asks the DATABASE to do the counting/summing. Instead of
 * downloading 500 expense rows and adding them up in JavaScript, we send ONE
 * query saying: "GROUP the rows by category, and for each category give me
 * SUM(amount)". The database (which already has all the data) answers in
 * microseconds and sends back ~10 tiny rows. Less data over the wire,
 * less work for our server, faster page for the user.
 */
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { fail, isDenied, ok, requireUser } from "@/lib/api";
import { percentage, round2, savingsRate } from "@/lib/finance";
import { monthEndKey, monthKeyOf, monthStartKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Sum income/expense totals between two dates for a user. */
async function totalsForRange(userId: number, from: string, to: string) {
  const [row] = await db
    .select({
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    );
  return { income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) };
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const url = new URL(request.url);
  const monthKey = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "")
    ? String(url.searchParams.get("month"))
    : monthKeyOf(new Date().toISOString().slice(0, 10));

  const from = monthStartKey(monthKey);
  const to = monthEndKey(monthKey);

  // Previous month key, e.g. "2026-01" -> "2025-12".
  const [year, month] = monthKey.split("-").map(Number);
  const prev = new Date(year, month - 2, 1); // JS month is 0-based
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const current = await totalsForRange(auth.id, from, to);
  const previous = await totalsForRange(auth.id, monthStartKey(prevKey), monthEndKey(prevKey));

  // THE AGGREGATION: expense totals grouped by category for the donut chart.
  const byCategory = await db
    .select({
      category: transactions.category,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, auth.id),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(transactions.category)
    .orderBy(desc(sql`SUM(${transactions.amount})`));

  const categoryRows = byCategory.map((c) => ({
    category: c.category,
    total: round2(Number(c.total)),
    share: percentage(Number(c.total), current.expense),
  }));

  // Biggest mover vs last month (for the "food spending is up 18%" insight).
  const prevByCategory = await db
    .select({
      category: transactions.category,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, auth.id),
        eq(transactions.type, "expense"),
        gte(transactions.date, monthStartKey(prevKey)),
        lte(transactions.date, monthEndKey(prevKey))
      )
    )
    .groupBy(transactions.category);

  let categoryChange: { category: string; changePercent: number } | null = null;
  for (const c of categoryRows) {
    const before = Number(
      prevByCategory.find((p) => p.category === c.category)?.total ?? 0
    );
    if (before > 100) {
      const changePercent = ((c.total - before) / before) * 100;
      if (!categoryChange || changePercent > categoryChange.changePercent) {
        categoryChange = { category: c.category, changePercent: round2(changePercent) };
      }
    }
  }

  return ok({
    month: monthKey,
    income: round2(current.income),
    expense: round2(current.expense),
    saved: round2(current.income - current.expense),
    savingsRate: savingsRate(current.income, current.expense),
    prevMonth: prevKey,
    prevIncome: round2(previous.income),
    prevExpense: round2(previous.expense),
    expenseChangePercent:
      previous.expense > 0
        ? round2(((current.expense - previous.expense) / previous.expense) * 100)
        : null,
    topCategories: categoryRows.slice(0, 3),
    categoryBreakdown: categoryRows,
    categoryChange,
  });
}
