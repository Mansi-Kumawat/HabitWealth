/**
 * /api/users/profile - read (GET) or update (PUT) the logged-in user's
 * financial profile: contact details, occupation, income/savings targets,
 * and free-text financial goals.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { publicUser } from "@/lib/auth";
import { fail, isDenied, ok, requireUser, validateAmount } from "@/lib/api";
import { round2 } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  return ok(publicUser(auth));
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const incomeTarget = Number(body.monthlyIncomeTarget ?? 0);
  const savingsTarget = Number(body.monthlySavingsTarget ?? 0);

  // Targets may be zero (not set yet) but never negative or absurd.
  if (incomeTarget < 0) return fail("Income target cannot be negative.");
  if (savingsTarget < 0) return fail("Savings target cannot be negative.");
  const amountError =
    (incomeTarget > 0 && validateAmount(incomeTarget, "Income target")) ||
    (savingsTarget > 0 && validateAmount(savingsTarget, "Savings target"));
  if (amountError) return fail(amountError);
  if (savingsTarget > incomeTarget && incomeTarget > 0) {
    return fail("Savings target can't be higher than your income target.");
  }

  const updated = await db
    .update(users)
    .set({
      name: String(body.name ?? auth.name).trim().slice(0, 80) || auth.name,
      phone: String(body.phone ?? "").slice(0, 20),
      occupation: String(body.occupation ?? "").slice(0, 80),
      monthlyIncomeTarget: round2(incomeTarget),
      monthlySavingsTarget: round2(savingsTarget),
      financialGoalsText: String(body.financialGoalsText ?? "").slice(0, 1000),
    })
    .where(eq(users.id, auth.id))
    .returning();

  return ok(publicUser(updated[0]), "Profile updated.");
}
