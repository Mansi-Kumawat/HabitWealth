/**
 * /api/goals/[id]/contributions
 * GET  - the deposit/withdrawal history of one goal.
 * POST - add money (positive amount) or withdraw (negative amount).
 *        We update the goal's cached currentAmount in the SAME request, and
 *        auto-complete the goal when the target is reached.
 */
import { db } from "@/db";
import { goalContributions, savingsGoals } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { fail, isDenied, ok, requireUser } from "@/lib/api";
import { round2 } from "@/lib/finance";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;

  const rows = await db
    .select()
    .from(goalContributions)
    .where(
      and(
        eq(goalContributions.goalId, Number(id)),
        eq(goalContributions.userId, auth.id)
      )
    )
    .orderBy(desc(goalContributions.createdAt));
  return ok(rows);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0)
    return fail("Amount must be a non-zero number.");
  if (Math.abs(amount) > 5_000_000) return fail("Amount looks too large.");
  const action = body.action === "withdraw" ? "withdraw" : "add";

  // Load the goal (ownership-checked) before touching anything.
  const goalRows = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, Number(id)), eq(savingsGoals.userId, auth.id)));
  const goal = goalRows[0];
  if (!goal) return fail("Goal not found.", 404);
  if (goal.status === "completed") return fail("This goal is already completed.");

  // Store withdrawals as negative numbers so SUM(contributions) = currentAmount.
  const signedAmount = round2(action === "withdraw" ? -Math.abs(amount) : Math.abs(amount));
  const newTotal = round2(goal.currentAmount + signedAmount);
  if (newTotal < 0) return fail("You can't withdraw more than the goal contains.");

  // 1. Record the history row.
  await db.insert(goalContributions).values({
    goalId: goal.id,
    userId: auth.id,
    amount: signedAmount,
    note: String(body.note ?? "").slice(0, 120),
  });

  // 2. Update the goal's running total (+ auto-complete when target reached).
  const reached = newTotal >= goal.targetAmount;
  const updated = await db
    .update(savingsGoals)
    .set({
      currentAmount: newTotal,
      status: reached ? "completed" : "active",
    })
    .where(eq(savingsGoals.id, goal.id))
    .returning();

  return ok(
    updated[0],
    reached
      ? `Target reached - "${goal.title}" is fully funded!`
      : action === "withdraw"
        ? "Withdrawal recorded."
        : "Contribution added. Keep it up!",
    201
  );
}
