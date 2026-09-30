/**
 * /api/transactions/[id] - edit (PUT) or delete (DELETE) one transaction.
 * The AND(id, userId) pattern guarantees you can never touch someone else's
 * record, even by guessing ids.
 */
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateDateKey,
} from "@/lib/api";
import { round2 } from "@/lib/finance";
import { saveMonthlySnapshot } from "@/lib/wealth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const amountError = validateAmount(body.amount);
  if (amountError) return fail(amountError);
  const dateError = validateDateKey(body.date);
  if (dateError) return fail(dateError);

  const updated = await db
    .update(transactions)
    .set({
      type: body.type === "income" ? "income" : "expense",
      category: String(body.category ?? "Other").slice(0, 40),
      amount: round2(Number(body.amount)),
      date: body.date,
      note: String(body.note ?? "").slice(0, 200),
      paymentMethod: String(body.paymentMethod ?? "UPI").slice(0, 30),
    })
    .where(and(eq(transactions.id, Number(id)), eq(transactions.userId, auth.id)))
    .returning();
  if (updated.length === 0) return fail("Transaction not found.", 404);

  await saveMonthlySnapshot(auth.id);
  return ok(updated[0], "Transaction updated.");
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const deleted = await db
    .delete(transactions)
    .where(and(eq(transactions.id, Number(id)), eq(transactions.userId, auth.id)))
    .returning();
  if (deleted.length === 0) return fail("Transaction not found.", 404);

  await saveMonthlySnapshot(auth.id);
  return ok(null, "Transaction deleted.");
}
