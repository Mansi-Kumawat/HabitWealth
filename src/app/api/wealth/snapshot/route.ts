/**
 * POST /api/wealth/snapshot - the "Save today's snapshot" button.
 * Recomputes wealth totals and upserts this month's net-worth snapshot row.
 * (This also happens automatically on every transaction/wealth change - this
 * endpoint just lets the user do it on demand.)
 */
import { isDenied, ok, requireUser } from "@/lib/api";
import { saveMonthlySnapshot } from "@/lib/wealth";
import { monthKeyOf, todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser();
  if (isDenied(auth)) return auth;
  const totals = await saveMonthlySnapshot(auth.id);
  return ok(
    { monthKey: monthKeyOf(todayKey()), ...totals },
    "Snapshot saved for this month."
  );
}
