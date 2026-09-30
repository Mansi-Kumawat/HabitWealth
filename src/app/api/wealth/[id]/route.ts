/**
 * /api/wealth/[id] - update (PUT) or delete (DELETE) one wealth item.
 * Typical update: "my index fund is now worth ₹52,300 instead of ₹50,000".
 * Every change refreshes this month's net worth snapshot.
 */
import { db } from "@/db";
import { wealthItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateText,
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

  if (body.name !== undefined) {
    const nameError = validateText(body.name, "Name", 80);
    if (nameError) return fail(nameError);
  }
  if (body.currentValue !== undefined) {
    const valueError = validateAmount(body.currentValue, "Current value");
    if (valueError) return fail(valueError);
  }

  const updated = await db
    .update(wealthItems)
    .set({
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.subType !== undefined ? { subType: String(body.subType).slice(0, 40) } : {}),
      ...(body.investedAmount !== undefined
        ? { investedAmount: round2(Number(body.investedAmount)) }
        : {}),
      ...(body.currentValue !== undefined
        ? { currentValue: round2(Number(body.currentValue)) }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(wealthItems.id, Number(id)), eq(wealthItems.userId, auth.id)))
    .returning();

  if (updated.length === 0) return fail("Item not found.", 404);
  await saveMonthlySnapshot(auth.id);
  return ok(updated[0], "Updated.");
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;

  const deleted = await db
    .delete(wealthItems)
    .where(and(eq(wealthItems.id, Number(id)), eq(wealthItems.userId, auth.id)))
    .returning();
  if (deleted.length === 0) return fail("Item not found.", 404);

  await saveMonthlySnapshot(auth.id);
  return ok(null, "Item deleted.");
}
