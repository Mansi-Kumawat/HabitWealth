/**
 * /api/categories - GET returns the global default categories plus any custom
 * ones this user created. POST adds a custom category for this user only.
 */
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, isNull, or } from "drizzle-orm";
import { fail, isDenied, ok, requireUser, validateText } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const rows = await db
    .select()
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, auth.id)));
  return ok(rows);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const body = await request.json().catch(() => null);
  if (!body) return fail("Invalid request body.");
  const nameError = validateText(body.name, "Category name", 40);
  if (nameError) return fail(nameError);

  const inserted = await db
    .insert(categories)
    .values({
      userId: auth.id,
      name: String(body.name).trim(),
      type: body.type === "income" ? "income" : "expense",
    })
    .returning();
  return ok(inserted[0], "Category added.", 201);
}
