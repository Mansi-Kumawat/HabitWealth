/**
 * /api/transactions
 * GET  - paginated list with filters: ?type= &category= &from= &to= &page=
 * POST - add a new income or expense record.
 *
 * PAGINATION means returning results in "pages" (e.g. 10 at a time) instead
 * of thousands of rows at once - essential for speed and low memory.
 * We return { rows, total, page, totalPages } so the UI can draw page buttons.
 */
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateDateKey,
} from "@/lib/api";
import { round2 } from "@/lib/finance";
import { todayKey } from "@/lib/dates";
import { saveMonthlySnapshot } from "@/lib/wealth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  // URL query parameters, e.g. /api/transactions?category=Food&page=2
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const category = url.searchParams.get("category");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

  // Build the WHERE conditions list: every filter the user picked.
  const conditions = [eq(transactions.userId, auth.id)]; // ownership first!
  if (type === "income" || type === "expense")
    conditions.push(eq(transactions.type, type));
  if (category) conditions.push(eq(transactions.category, category));
  if (from && !validateDateKey(from)) conditions.push(gte(transactions.date, from));
  if (to && !validateDateKey(to)) conditions.push(lte(transactions.date, to));
  const where = and(...conditions);

  // Total count (for page numbers) + one page of rows, newest first.
  const [countRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(where);
  const total = Number(countRow?.total ?? 0);

  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE); // "skip" the rows of earlier pages

  return ok({
    rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  // ----- validation -----
  const type = body.type === "income" ? "income" : "expense";
  const amountError = validateAmount(body.amount);
  if (amountError) return fail(amountError);
  const dateError = validateDateKey(body.date);
  if (dateError) return fail(dateError);
  const category = String(body.category ?? "Other").trim().slice(0, 40) || "Other";

  const inserted = await db
    .insert(transactions)
    .values({
      userId: auth.id,
      type,
      category,
      amount: round2(Number(body.amount)),
      date: body.date || todayKey(),
      note: String(body.note ?? "").slice(0, 200),
      paymentMethod: String(body.paymentMethod ?? "UPI").slice(0, 30),
    })
    .returning();

  // Keep this month's net worth snapshot fresh (fire and forget style).
  await saveMonthlySnapshot(auth.id);

  return ok(inserted[0], type === "income" ? "Income added." : "Expense logged.", 201);
}
