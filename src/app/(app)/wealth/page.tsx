"use client";

/**
 * WEALTH ANALYTICS PAGE
 * =====================
 * Track what you OWN (savings, investments, assets) and what you OWE
 * (liabilities), and watch the net worth line grow:
 *     net worth = savings + investments (current value) + assets − liabilities
 *
 * Charts here:
 *  - Net worth line chart (from monthly snapshot rows)
 *  - Asset allocation donut (how wealth is split)
 *  - Investment gain/loss bars (current value minus invested amount)
 * Plus a "Save today's snapshot" button and full add/edit/delete of items.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client";
import { formatMoney, formatMoneyShort } from "@/lib/currency";
import {
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorBanner,
  Field,
  Flash,
  Input,
  Select,
  SkeletonBlock,
  StatCard,
} from "@/components/ui";
import { Camera, Pencil, Trash2, TrendingUp, Vault, Landmark, CreditCard } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WealthItem {
  id: number;
  kind: "investment" | "asset" | "liability";
  name: string;
  subType: string | null;
  investedAmount: number;
  currentValue: number;
}
interface WealthData {
  items: WealthItem[];
  totals: { savings: number; investments: number; assets: number; liabilities: number; netWorth: number };
  snapshots: { monthKey: string; netWorth: number; savings: number; investments: number }[];
}

const INVESTMENT_TYPES = ["Mutual Fund", "Stocks", "FD", "Gold", "PPF", "Other"];
const ALLOC_COLORS = ["#0d7a5f", "#d9a13b", "#3d7dd8", "#7c5cc4"];

const emptyItem = {
  kind: "investment" as "investment" | "asset" | "liability",
  name: "",
  subType: "Mutual Fund",
  investedAmount: "",
  currentValue: "",
};

export default function WealthPage() {
  const [data, setData] = useState<WealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<WealthData>("/wealth"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wealth data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flashMessage(kind: "success" | "error", text: string) {
    setFlash({ kind, text });
    if (kind === "success") window.setTimeout(() => setFlash(null), 4000);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return flashMessage("error", "Please name the item.");
    if (!form.currentValue || Number(form.currentValue) <= 0)
      return flashMessage("error", "Current value must be greater than zero.");
    if (form.kind === "investment" && (!form.investedAmount || Number(form.investedAmount) <= 0))
      return flashMessage("error", "Invested amount must be greater than zero.");
    setFormBusy(true);
    try {
      const payload = {
        ...form,
        investedAmount: form.investedAmount ? Number(form.investedAmount) : 0,
        currentValue: Number(form.currentValue),
      };
      if (editingId) {
        await api.put(`/wealth/${editingId}`, payload);
        flashMessage("success", "Item updated.");
      } else {
        await api.post("/wealth", payload);
        flashMessage("success", `${form.kind} added.`);
      }
      setEditingId(null);
      setForm(emptyItem);
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function removeItem(item: WealthItem) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.del(`/wealth/${item.id}`);
      flashMessage("success", "Item deleted.");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  async function saveSnapshot() {
    setSnapshotBusy(true);
    try {
      await api.post("/wealth/snapshot");
      flashMessage("success", "Snapshot saved - the growth chart is up to date.");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Snapshot failed.");
    } finally {
      setSnapshotBusy(false);
    }
  }

  if (loading && !data) return <SkeletonBlock lines={5} />;
  if (error || !data) return <ErrorBanner message={error ?? "No data."} onRetry={load} />;

  const investments = data.items.filter((i) => i.kind === "investment");
  const others = data.items.filter((i) => i.kind !== "investment");

  // Donut data: where does the (positive) wealth live?
  const allocation = [
    { name: "Cash savings", value: Math.max(0, data.totals.savings) },
    { name: "Investments", value: data.totals.investments },
    { name: "Assets", value: data.totals.assets },
  ].filter((a) => a.value > 0);

  // Gain/loss bars: one bar per investment.
  const gainLoss = investments.map((i) => ({
    name: i.name.length > 14 ? `${i.name.slice(0, 14)}…` : i.name,
    change: Math.round((i.currentValue - i.investedAmount) * 100) / 100,
  }));

  // Trend: savings vs expenses would need transaction sums; we already save
  // savings in every snapshot, so we chart savings alongside net worth.
  const netWorthSeries = data.snapshots.map((s) => ({
    month: s.monthKey,
    netWorth: s.netWorth,
    savings: s.savings,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Wealth Analytics</h1>
          <p className="mt-1 text-sm text-ink-soft">Own minus owe, watched over months.</p>
        </div>
        <Button variant="ghost" busy={snapshotBusy} onClick={saveSnapshot}>
          <Camera size={15} /> Save today&apos;s snapshot
        </Button>
      </div>
      {flash && <Flash kind={flash.kind} text={flash.text} />}

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net worth" value={formatMoney(data.totals.netWorth)} icon={<TrendingUp size={19} />} tone="gold" caption="savings + investments + assets − liabilities" />
        <StatCard label="Cash savings" value={formatMoney(data.totals.savings)} icon={<Vault size={19} />} tone="leaf" caption="income ever logged − expenses" />
        <StatCard label="Investments & assets" value={formatMoney(data.totals.investments + data.totals.assets)} icon={<Landmark size={19} />} tone="sky" />
        <StatCard label="Liabilities" value={formatMoney(data.totals.liabilities)} icon={<CreditCard size={19} />} tone="rose" caption="loans & dues outstanding" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title="Net worth over time" hint="One point per monthly snapshot" />
          {netWorthSeries.length < 2 ? (
            <p className="py-12 text-center text-sm text-ink-faint">
              At least 2 monthly snapshots are needed for a trend line. Keep logging - the chart grows with you.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e4de" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoneyShort(Number(v))} width={56} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                  <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#0d7a5f" strokeWidth={2.5} dot={{ r: 3, fill: "#0d7a5f" }} />
                  <Line type="monotone" dataKey="savings" name="Cash savings" stroke="#d9a13b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle title="Asset allocation" hint="Where your wealth lives" />
          {allocation.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-faint">Add investments or assets to see the split.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={3}>
                    {allocation.map((_, i) => <Cell key={i} fill={ALLOC_COLORS[i % ALLOC_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-1 space-y-1.5">
            {allocation.map((row, i) => (
              <li key={row.name} className="flex items-center justify-between text-xs text-ink-soft">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                  {row.name}
                </span>
                {formatMoney(row.value)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {gainLoss.length > 0 && (
        <Card>
          <CardTitle title="Investment gain / loss" hint="Current value minus amount invested" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gainLoss}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e4de" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoneyShort(Number(v))} width={56} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                <ReferenceLine y={0} stroke="#93a29a" />
                <Bar dataKey="change" name="Gain / loss" radius={[6, 6, 0, 0]}>
                  {gainLoss.map((row, i) => (
                    <Cell key={i} fill={row.change >= 0 ? "#0d7a5f" : "#d6455b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Add / edit form */}
      <Card>
        <CardTitle title={editingId ? "Edit item" : "Add investment, asset or liability"} hint="Update current values monthly for a smooth growth line" />
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Kind">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
              <option value="investment">Investment</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </Select>
          </Field>
          <Field label="Name">
            <Input placeholder="Nifty 50 Index Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Type">
            {form.kind === "investment" ? (
              <Select value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })}>
                {INVESTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            ) : (
              <Input placeholder={form.kind === "asset" ? "Bank balance / Gold / Bike" : "Personal loan / Home loan"} value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} />
            )}
          </Field>
          {form.kind === "investment" && (
            <Field label="Invested amount (₹)">
              <Input type="number" min="0" step="0.01" placeholder="24000" value={form.investedAmount} onChange={(e) => setForm({ ...form, investedAmount: e.target.value })} />
            </Field>
          )}
          <Field label={form.kind === "liability" ? "Outstanding (₹)" : "Current value (₹)"}>
            <Input type="number" min="0" step="0.01" placeholder="52300" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" busy={formBusy}>{editingId ? "Save changes" : "Add item"}</Button>
            {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyItem); }}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {/* Item lists */}
      {data.items.length === 0 ? (
        <EmptyState title="No wealth items yet" hint="Add your first investment (a SIP, FD, a bit of gold) to start measuring growth." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle title="Investments" hint="Gain/loss vs invested amount" />
            <ul className="divide-y divide-line">
              {investments.map((item) => {
                const change = item.currentValue - item.investedAmount;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-ink-faint">{item.subType} · invested {formatMoney(item.investedAmount)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="mr-2 text-right">
                        <p className="text-sm font-bold text-ink">{formatMoney(item.currentValue)}</p>
                        <p className={`text-xs font-semibold ${change >= 0 ? "text-leaf" : "text-rose"}`}>
                          {change >= 0 ? "+" : "−"}{formatMoney(Math.abs(change))}
                        </p>
                      </div>
                      <button onClick={() => { setEditingId(item.id); setForm({ kind: item.kind, name: item.name, subType: item.subType ?? "Other", investedAmount: String(item.investedAmount), currentValue: String(item.currentValue) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg p-2 text-ink-faint hover:bg-leaf-soft hover:text-leaf"><Pencil size={15} /></button>
                      <button onClick={() => removeItem(item)} className="rounded-lg p-2 text-ink-faint hover:bg-rose-soft hover:text-rose"><Trash2 size={15} /></button>
                    </div>
                  </li>
                );
              })}
              {investments.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No investments tracked yet.</p>}
            </ul>
          </Card>

          <Card>
            <CardTitle title="Assets & liabilities" hint="Everything else you own or owe" />
            <ul className="divide-y divide-line">
              {others.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-faint">{item.kind} · {item.subType}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`mr-2 text-sm font-bold ${item.kind === "liability" ? "text-rose" : "text-ink"}`}>
                      {item.kind === "liability" ? "−" : ""}{formatMoney(item.currentValue)}
                    </span>
                    <button onClick={() => { setEditingId(item.id); setForm({ kind: item.kind, name: item.name, subType: item.subType ?? "Other", investedAmount: String(item.investedAmount), currentValue: String(item.currentValue) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg p-2 text-ink-faint hover:bg-leaf-soft hover:text-leaf"><Pencil size={15} /></button>
                    <button onClick={() => removeItem(item)} className="rounded-lg p-2 text-ink-faint hover:bg-rose-soft hover:text-rose"><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
              {others.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">No assets or liabilities tracked yet.</p>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
