/**
 * GET /api/admin/feedback?status= - admin-only: list all feedback tickets,
 * optionally filtered by status (open / in_progress / resolved), with the
 * author's name and email joined from the users table.
 *
 * A JOIN combines two tables in one query: "for each feedback row, attach
 * the user row whose id matches feedback.user_id".
 */
import { db } from "@/db";
import { feedback, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { isDenied, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin;

  const status = new URL(request.url).searchParams.get("status");
  const allowedStatuses = ["open", "in_progress", "resolved"] as const;
  const statusFilter = allowedStatuses.includes(status as never)
    ? eq(feedback.status, status as (typeof allowedStatuses)[number])
    : undefined;

  const rows = await db
    .select({
      id: feedback.id,
      subject: feedback.subject,
      message: feedback.message,
      status: feedback.status,
      adminNote: feedback.adminNote,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .where(statusFilter)
    .orderBy(desc(feedback.createdAt))
    .limit(200);

  return ok(rows);
}
