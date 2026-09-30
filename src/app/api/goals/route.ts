/**
 * /api/goals
 * GET  - the user's savings goals, each enriched with: percent complete,
 *        "on-track / behind / done" pace indicator, estimated completion date,
 *        and average monthly contribution pace.
 * POST - create a new goal (title, target, optional deadline + priority).
 */
import { db } from "@/db";
import { goalContributions, savingsGoals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  fail,
  isDenied,
  ok,
  requireUser,
  validateAmount,
  validateDateKey,
  validateText,
} from "@/lib/api";
import {
  clamp,
  estimateGoalCompletion,
  goalPace,
  percentage,
  round2,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, auth.id))
    .orderBy(desc(savingsGoals.createdAt));

  const contributions = await db
    .select()
    .from(goalContributions)
    .where(eq(goalContributions.userId, auth.id));

  const enriched = goals.map((goal) => {
    const goalContribs = contributions.filter((c) => c.goalId === goal.id);
    // Average monthly saving pace = total deposited / months since creation.
    const monthsActive = Math.max(
      1,
      (Date.now() - goal.createdAt.getTime()) / (30.44 * 24 * 3600 * 1000)
    );
    const monthlyPace = round2(
      goalContribs.reduce((sum, c) => sum + c.amount, 0) / monthsActive
    );
    return {
      ...goal,
      percentComplete: clamp(percentage(goal.currentAmount, goal.targetAmount), 0, 100),
      pace: goalPace(goal),
      monthlyPace,
      estimatedCompletion: estimateGoalCompletion(
        goal.targetAmount - goal.currentAmount,
        monthlyPace
      ),
      contributionCount: goalContribs.length,
    };
  });

  return ok(enriched);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const titleError = validateText(body.title, "Goal title", 80);
  if (titleError) return fail(titleError);
  const amountError = validateAmount(body.targetAmount, "Target amount");
  if (amountError) return fail(amountError);
  if (body.deadline) {
    const dateError = validateDateKey(body.deadline, "Deadline");
    if (dateError) return fail(dateError);
    if (body.deadline <= new Date().toISOString().slice(0, 10))
      return fail("Deadline must be in the future.");
  }

  const inserted = await db
    .insert(savingsGoals)
    .values({
      userId: auth.id,
      title: String(body.title).trim(),
      targetAmount: round2(Number(body.targetAmount)),
      currentAmount: 0,
      deadline: body.deadline || null,
      priority: ["low", "medium", "high"].includes(body.priority)
        ? body.priority
        : "medium",
    })
    .returning();

  return ok(inserted[0], "Goal created. First contribution next!", 201);
}
