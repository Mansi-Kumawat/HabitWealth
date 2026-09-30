/**
 * GET /api/transactions/report?month=YYYY-MM -> downloads a CSV file.
 *
 * CSV = "comma-separated values": a plain-text table Excel/Google Sheets can
 * open. Generating it is just building strings and sending them with the
 * right headers. The `Content-Disposition: attachment` header tells the
 * browser to DOWNLOAD the response as a file instead of displaying it.
 */
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { isDenied, requireUser } from "@/lib/api";
import { monthEndKey, monthKeyOf, monthStartKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Escape a value for CSV: wrap in quotes when it contains , " or newlines. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;

  const url = new URL(request.url);
  const monthKey = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "")
    ? String(url.searchParams.get("month"))
    : monthKeyOf(new Date().toISOString().slice(0, 10));

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, auth.id),
        gte(transactions.date, monthStartKey(monthKey)),
        lte(transactions.date, monthEndKey(monthKey))
      )
    )
    .orderBy(asc(transactions.date));

  const header = "Date,Type,Category,Amount (INR),Payment Method,Note";
  const lines = rows.map((t) =>
    [
      t.date,
      t.type,
      csvCell(t.category),
      t.amount.toFixed(2),
      csvCell(t.paymentMethod ?? ""),
      csvCell(t.note ?? ""),
    ].join(",")
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${monthKey}.csv"`,
    },
  });
}
