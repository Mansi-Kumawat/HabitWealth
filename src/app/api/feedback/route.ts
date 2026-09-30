/**
 * /api/feedback
 * GET  - the logged-in user's OWN feedback tickets (with any admin replies).
 * POST - submit a new issue/complaint. Admins answer it in the admin panel.
 */
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { fail, isDenied, ok, requireUser, validateText } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, auth.id))
    .orderBy(desc(feedback.createdAt));
  return ok(rows);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const subjectError = validateText(body.subject, "Subject", 120);
  if (subjectError) return fail(subjectError);
  const messageError = validateText(body.message, "Message", 2000);
  if (messageError) return fail(messageError);

  const inserted = await db
    .insert(feedback)
    .values({
      userId: auth.id,
      subject: String(body.subject).trim(),
      message: String(body.message).trim(),
    })
    .returning();

  return ok(
    inserted[0],
    "Thanks for the feedback! Our team will take a look.",
    201
  );
}
