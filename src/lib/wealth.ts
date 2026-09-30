/**
 * WEALTH TOTALS + NET WORTH SNAPSHOT SERVICE
 * ==========================================
 * A "service" is a plain module with functions that several routes share.
 * Putting shared logic here (instead of copy-pasting it into 6 route files)
 * is the "separate controllers/services" idea from clean architecture.
 */

import { db } from "@/db";
import {
  netWorthSnapshots,
  transactions,
  wealthItems,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { computeNetWorth, round2 } from "./finance";
import { monthKeyOf, todayKey } from "./dates";

export interface WealthTotals {
  savings: number; // all-time income minus all-time expenses ("cash kept")
  investments: number; // sum of investment current values
  assets: number; // sum of asset current values
  liabilities: number; // sum of outstanding loan values
  netWorth: number;
}

/**
 * Compute the user's CURRENT wealth totals.
 *
 * We ask the database to SUM and GROUP for us instead of downloading all
 * rows and adding them in JavaScript. `sql`...`` is a raw SQL fragment -
 * `SUM(CASE WHEN ...)` means "add up amounts, counting income as positive
 * and expenses as negative" in ONE fast database query.
 */
export async function computeWealthTotals(userId: number): Promise<WealthTotals> {
  // 1. Cash savings = every income ever logged minus every expense ever.
  const [cash] = await db
    .select({
      balance: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income'
        THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // 2. Group wealth items by kind and sum current values.
  const grouped = await db
    .select({
      kind: wealthItems.kind,
      total: sql<number>`COALESCE(SUM(${wealthItems.currentValue}), 0)`,
    })
    .from(wealthItems)
    .where(eq(wealthItems.userId, userId))
    .groupBy(wealthItems.kind);

  const investments = grouped.find((g) => g.kind === "investment")?.total ?? 0;
  const assets = grouped.find((g) => g.kind === "asset")?.total ?? 0;
  const liabilities = grouped.find((g) => g.kind === "liability")?.total ?? 0;
  const savings = round2(Number(cash?.balance ?? 0));

  return {
    savings,
    investments: round2(Number(investments)),
    assets: round2(Number(assets)),
    liabilities: round2(Number(liabilities)),
    netWorth: computeNetWorth({
      savings,
      investments: Number(investments),
      assets: Number(assets),
      liabilities: Number(liabilities),
    }),
  };
}

/**
 * Save (or overwrite) THIS MONTH's snapshot for the user.
 * "Upsert" = UPDATE if the row exists, INSERT if it doesn't - implemented as
 * try-update-then-insert so a beginner can follow the flow. We call this
 * after any transaction/wealth change so the growth chart always has fresh
 * data, plus the user has a "Save today's snapshot" button that calls it too.
 */
export async function saveMonthlySnapshot(userId: number): Promise<WealthTotals> {
  const totals = await computeWealthTotals(userId);
  const monthKey = monthKeyOf(todayKey());

  const existing = await db
    .select()
    .from(netWorthSnapshots)
    .where(
      and(
        eq(netWorthSnapshots.userId, userId),
        eq(netWorthSnapshots.monthKey, monthKey)
      )
    );

  if (existing.length > 0) {
    await db
      .update(netWorthSnapshots)
      .set({ ...totals, createdAt: new Date() })
      .where(eq(netWorthSnapshots.id, existing[0].id));
  } else {
    await db.insert(netWorthSnapshots).values({ userId, monthKey, ...totals });
  }
  return totals;
}
