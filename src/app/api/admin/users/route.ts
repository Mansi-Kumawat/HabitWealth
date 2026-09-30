/**
 * GET /api/admin/users?q= - admin-only: search + list all users with basic
 * SUMMARY counts (how many transactions/goals/habits they have).
 *
 * PRIVACY BY DESIGN: we deliberately return profile info + counts ONLY.
 * Admins canNOT see how much money any user has or what they bought - that
 * is the user's private data. Managing a platform doesn't require reading
 * anyone's wallet.
 */
import { db } from "@/db";
import { habitLogs, habits, savingsGoals, transactions, users } from "@/db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { fail, isDenied, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const conditions = q
    ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      occupation: users.occupation,
      createdAt: users.createdAt,
      // Correlated subqueries: one COUNT per user, grouped by user id.
      transactionCount: sql<number>`(SELECT COUNT(*) FROM ${transactions} WHERE ${transactions.userId} = ${users.id})`,
      habitCount: sql<number>`(SELECT COUNT(*) FROM ${habits} WHERE ${habits.userId} = ${users.id})`,
      goalCount: sql<number>`(SELECT COUNT(*) FROM ${savingsGoals} WHERE ${savingsGoals.userId} = ${users.id})`,
    })
    .from(users)
    .where(conditions)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return ok(rows.map((r) => ({ ...r, transactionCount: Number(r.transactionCount), habitCount: Number(r.habitCount), goalCount: Number(r.goalCount) })));
}
