/**
 * /api/goals/[id] - edit goal details, mark as completed (PUT), or delete
 * a goal and its contribution history (DELETE).
 */
import { db } from "@/db";
import { goalContributions, savingsGoals } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateDateKey,
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

  if (body.title !== undefined) {
    const titleError = validateText(body.title, "Goal title", 80);
    if (titleError) return fail(titleError);
  }
  if (body.targetAmount !== undefined) {
    const amountError = validateAmount(body.targetAmount, "Target amount");
    if (amountError) return fail(amountError);
  }
  if (body.deadline) {
    const dateError = validateDateKey(body.deadline, "Deadline");
    if (dateError) return fail(dateError);
  }

  const updated = await db
    .update(savingsGoals)
    .set({
      ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body.targetAmount !== undefined
        ? { targetAmount: round2(Number(body.targetAmount)) }
        : {}),
      ...(body.deadline !== undefined ? { deadline: body.deadline || null } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.status !== undefined
        ? { status: body.status === "completed" ? "completed" : "active" }
        : {}),
    })
    .where(and(eq(savingsGoals.id, Number(id)), eq(savingsGoals.userId, auth.id)))
    .returning();

  if (updated.length === 0) return fail("Goal not found.", 404);
  const message =
    body.status === "completed"
      ? "Goal marked complete - congratulations!"
      : "Goal updated.";
  return ok(updated[0], message);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;

  const deleted = await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, Number(id)), eq(savingsGoals.userId, auth.id)))
    .returning();
  if (deleted.length === 0) return fail("Goal not found.", 404);

  await db.delete(goalContributions).where(eq(goalContributions.goalId, Number(id)));
  return ok(null, "Goal deleted.");
}
