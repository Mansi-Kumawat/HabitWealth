"use client";

/**
 * EXPENSE & INCOME TRACKER
 * ========================
 * Three parts on one page:
 *  1. A form (top) to add records - it flips into "edit mode" when you click
 *     the pencil on a row.
 *  2. A filterable, paginated list (server does the filtering, see
 *     /api/transactions).
 *  3. A monthly report card: totals, savings rate, top 3 categories, change
 *     vs last month, and a "Download CSV" button (points at
 *     /api/transactions/report - the browser downloads that URL as a file).
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client";
import { formatMoney } from "@/lib/currency";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorBanner,
  Field,
  Flash,
  Input,
  ProgressBar,
  Select,
  SkeletonBlock,
} from "@/components/ui";
import { Pencil, Trash2, Download, PlusCircle } from "lucide-react";

interface TransactionRow {
  id: number;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  note: string | null;
  paymentMethod: string | null;
}
interface ListData { rows: TransactionRow[]; total: number; page: number; totalPages: number }
interface CategoryRow { id: number; name: string; type: string }
interface SummaryData {
  month: string; income: number; expense: number; saved: number; savingsRate: number;
  prevMonth: string; expenseChangePercent: number | null;
  topCategories: { category: string; total: number; share: number }[];
  categoryBreakdown: { category: string; total: number; share: number }[];
  categoryChange: { category: string; changePercent: number } | null;
}

const PAYMENT_METHODS = ["UPI", "Cash", "Card", "Net Banking", "Other"];

/** Blank form state (reused for "cancel edit" reset). */
const emptyForm = {
  type: "expense" as "income" | "expense",
  amount: "",
  category: "Food",
  date: new Date().toISOString().slice(0, 10),
  note: "",
  paymentMethod: "UPI",
};

export default function TransactionsPage() {
  const [list, setList] = useState<ListData | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Filters live in state; changing any of them reloads page 1.
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [page, setPage] = useState(1);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (filterType) params.set("type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    try {
      setList(await api.get<ListData>(`/transactions?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterCategory, filterFrom, filterTo]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api.get<SummaryData>("/transactions/summary"));
    } catch { /* summary is nice-to-have; list error covers failures */ }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    api.get<CategoryRow[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFlash(null);
    if (!form.amount || Number(form.amount) <= 0)
      return setFlash({ kind: "error", text: "Please enter an amount greater than zero." });
    setFormBusy(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        setFlash({ kind: "success", text: "Transaction updated." });
      } else {
        await api.post("/transactions", payload);
        setFlash({ kind: "success", text: `${form.type === "income" ? "Income" : "Expense"} added.` });
      }
      setEditingId(null);
      setForm(emptyForm);
      loadList();
      loadSummary();
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof ApiError ? err.message : "Save failed." });
    } finally {
      setFormBusy(false);
    }
  }

  function startEdit(row: TransactionRow) {
    setEditingId(row.id);
    setForm({
      type: row.type,
      amount: String(row.amount),
      category: row.category,
      date: row.date,
      note: row.note ?? "",
      paymentMethod: row.paymentMethod ?? "UPI",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(row: TransactionRow) {
    if (!window.confirm(`Delete "${row.note || row.category}" (${formatMoney(row.amount)})?`)) return;
    try {
      await api.del(`/transactions/${row.id}`);
      setFlash({ kind: "success", text: "Transaction deleted." });
      loadList();
      loadSummary();
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof ApiError ? err.message : "Delete failed." });
    }
  }

  const categoryOptions = categories.filter((c) =>
    form.type === "income" ? c.type === "income" : c.type === "expense"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Expenses & Income</h1>
          <p className="mt-1 text-sm text-ink-soft">Log every rupee. Awareness first, savings next.</p>
        </div>
        <a
          href="/api/transactions/report"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-leaf hover:text-leaf"
        >
          <Download size={15} /> Download CSV report
        </a>
      </div>

      {/* Add / edit form */}
      <Card>
        <CardTitle
          title={editingId ? "Edit transaction" : "Add a transaction"}
          hint={editingId ? "Update the fields and save" : "Income or expense - same simple form"}
        />
        {flash && <div className="mb-4"><Flash kind={flash.kind} text={flash.text} /></div>}
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input type="number" min="0" step="0.01" placeholder="349" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(categoryOptions.length ? categoryOptions : [{ id: 0, name: "Other", type: form.type }]).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Payment method">
            <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Note (optional)">
            <Input placeholder="Zomato order" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" busy={formBusy}>
              <PlusCircle size={15} /> {editingId ? "Save changes" : "Add transaction"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel edit
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Monthly report */}
      <Card>
        <CardTitle title={`Monthly report - ${summary?.month ?? "..."}`} hint="Totals, savings rate and top categories" />
        {!summary ? (
          <SkeletonBlock lines={2} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-sky-soft p-4">
                <p className="text-xs font-semibold uppercase text-sky">Total income</p>
                <p className="mt-1 text-xl font-bold text-ink">{formatMoney(summary.income)}</p>
              </div>
              <div className="rounded-xl bg-rose-soft p-4">
                <p className="text-xs font-semibold uppercase text-rose">Total expenses</p>
                <p className="mt-1 text-xl font-bold text-ink">{formatMoney(summary.expense)}</p>
                {summary.expenseChangePercent !== null && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {summary.expenseChangePercent >= 0 ? "▲" : "▼"} {Math.abs(summary.expenseChangePercent)}% vs {summary.prevMonth}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-leaf-soft p-4">
                <p className="text-xs font-semibold uppercase text-leaf">Savings rate</p>
                <p className="mt-1 text-xl font-bold text-ink">{summary.savingsRate}%</p>
                <ProgressBar percent={summary.savingsRate} />
              </div>
            </div>
            {summary.topCategories.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Top 3 spending categories</p>
                <div className="flex flex-wrap gap-2">
                  {summary.topCategories.map((c) => (
                    <Badge key={c.category} tone="plain">{c.category} · {formatMoney(c.total)} ({Math.round(c.share)}%)</Badge>
                  ))}
                </div>
              </div>
            )}
            {summary.categoryChange && summary.categoryChange.changePercent >= 15 && (
              <p className="rounded-xl bg-gold-soft px-3.5 py-2.5 text-sm text-ink">
                Heads up: {summary.categoryChange.category} spending is up {Math.round(summary.categoryChange.changePercent)}% vs last month.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Filters + list */}
      <Card>
        <CardTitle title="All transactions" hint={`${list?.total ?? 0} records match your filters`} />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filterType} onChange={(e) => { setPage(1); setFilterType(e.target.value); }}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
          <Select value={filterCategory} onChange={(e) => { setPage(1); setFilterCategory(e.target.value); }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </Select>
          <Input type="date" value={filterFrom} onChange={(e) => { setPage(1); setFilterFrom(e.target.value); }} aria-label="From date" />
          <Input type="date" value={filterTo} onChange={(e) => { setPage(1); setFilterTo(e.target.value); }} aria-label="To date" />
        </div>

        {loading ? (
          <SkeletonBlock lines={5} />
        ) : error ? (
          <ErrorBanner message={error} onRetry={loadList} />
        ) : !list || list.rows.length === 0 ? (
          <EmptyState title="No transactions found" hint="Try clearing the filters, or add your first record above." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{row.note || row.category}</p>
                    <p className="text-xs text-ink-faint">{row.category} · {row.date} · {row.paymentMethod}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`mr-2 text-sm font-bold ${row.type === "income" ? "text-leaf" : "text-rose"}`}>
                      {row.type === "income" ? "+" : "−"}{formatMoney(row.amount)}
                    </span>
                    <button onClick={() => startEdit(row)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-leaf-soft hover:text-leaf" aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(row)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose" aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination controls */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-faint">Page {list.page} of {list.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={list.page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="ghost" disabled={list.page >= list.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
