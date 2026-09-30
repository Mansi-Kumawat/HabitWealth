/**
 * /api/wealth
 * GET  - everything the Wealth Analytics page needs in ONE request:
 *        the item lists (investments / assets / liabilities), the computed
 *        totals (incl. net worth), and the historical monthly snapshots for
 *        the growth line chart.
 * POST - add an investment, asset or liability.
 */
import { db } from "@/db";
import { netWorthSnapshots, wealthItems } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateText,
} from "@/lib/api";
import { round2 } from "@/lib/finance";
import { computeWealthTotals, saveMonthlySnapshot } from "@/lib/wealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const items = await db
    .select()
    .from(wealthItems)
    .where(eq(wealthItems.userId, auth.id))
    .orderBy(desc(wealthItems.updatedAt));

  const snapshots = await db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.userId, auth.id))
    .orderBy(asc(netWorthSnapshots.monthKey));

  const totals = await computeWealthTotals(auth.id);

  return ok({ items, totals, snapshots });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const kind = ["investment", "asset", "liability"].includes(body.kind)
    ? (body.kind as "investment" | "asset" | "liability")
    : null;
  if (!kind) return fail("Kind must be investment, asset or liability.");
  const nameError = validateText(body.name, "Name", 80);
  if (nameError) return fail(nameError);
  const valueError = validateAmount(body.currentValue, "Current value");
  if (valueError) return fail(valueError);

  // Invested amount only makes sense for investments; a liability's "value"
  // is the outstanding loan and assets just have a current value.
  const invested =
    kind === "investment" && body.investedAmount
      ? Number(body.investedAmount)
      : 0;
  if (kind === "investment") {
    const investedError = validateAmount(invested, "Invested amount");
    if (investedError) return fail(investedError);
  }

  const inserted = await db
    .insert(wealthItems)
    .values({
      userId: auth.id,
      kind,
      name: String(body.name).trim(),
      subType: String(body.subType ?? "Other").slice(0, 40),
      investedAmount: round2(invested),
      currentValue: round2(Number(body.currentValue)),
    })
    .returning();

  await saveMonthlySnapshot(auth.id);
  return ok(inserted[0], `${kind} added.`, 201);
}
