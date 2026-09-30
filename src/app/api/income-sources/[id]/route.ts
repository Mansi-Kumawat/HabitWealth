/**
 * /api/income-sources/[id] - update (PUT) or delete (DELETE) one source.
 * The [id] folder name is Next.js syntax for a dynamic URL segment like
 * /api/income-sources/42 (Express equivalent: router.put('/:id', ...)).
 */
import { db } from "@/db";
import { incomeSources } from "@/db/schema";
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

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const nameError = validateText(body.name, "Source name", 60);
  if (nameError) return fail(nameError);
  const amountError = validateAmount(body.amount);
  if (amountError) return fail(amountError);

  // AND condition: the row must match BOTH the id AND the logged-in user.
  const updated = await db
    .update(incomeSources)
    .set({
      name: String(body.name).trim(),
      amount: round2(Number(body.amount)),
      frequency: body.frequency,
    })
    .where(
      and(eq(incomeSources.id, Number(id)), eq(incomeSources.userId, auth.id))
    )
    .returning();
  if (updated.length === 0) return fail("Income source not found.", 404);
  return ok(updated[0], "Income source updated.");
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const deleted = await db
    .delete(incomeSources)
    .where(
      and(eq(incomeSources.id, Number(id)), eq(incomeSources.userId, auth.id))
    )
    .returning();
  if (deleted.length === 0) return fail("Income source not found.", 404);
  return ok(null, "Income source deleted.");
}
