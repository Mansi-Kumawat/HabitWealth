/**
 * /api/income-sources - list (GET) and create (POST) income sources such as
 * "Salary", "Freelance design", "Internship stipend".
 *
 * SECURITY NOTE (applies to EVERY route in this app): the WHERE clause always
 * includes `eq(incomeSources.userId, auth.id)`. That means you can only ever
 * read or change YOUR OWN rows. Even if someone changes the id in the URL,
 * the database simply finds no matching row. This is called "row-level
 * ownership" and it is what keeps one user's finances private from another.
 */
import { db } from "@/db";
import { incomeSources } from "@/db/schema";
import { eq } from "drizzle-orm";
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

const FREQUENCIES = ["one-time", "weekly", "monthly", "yearly"] as const;

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const rows = await db
    .select()
    .from(incomeSources)
    .where(eq(incomeSources.userId, auth.id));
  return ok(rows);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");

  const nameError = validateText(body.name, "Source name", 60);
  if (nameError) return fail(nameError);
  const amountError = validateAmount(body.amount);
  if (amountError) return fail(amountError);
  const frequency = FREQUENCIES.includes(body.frequency)
    ? body.frequency
    : "monthly";

  const inserted = await db
    .insert(incomeSources)
    .values({
      userId: auth.id,
      name: String(body.name).trim(),
      amount: round2(Number(body.amount)),
      frequency,
    })
    .returning();
  return ok(inserted[0], "Income source added.", 201);
}
