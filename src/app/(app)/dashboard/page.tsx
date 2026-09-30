"use client";

/**
 * FINANCIAL DASHBOARD
 * ===================
 * The home page: summary cards, mini charts, today's habits, goal progress,
 * and rule-based motivational insights - ALL loaded with ONE request to
 * /api/dashboard (see that route for why combined endpoints are faster).
 *
 * CHARTS: Recharts components take plain arrays of objects. We map our API
 * data straight into <BarChart data={...}> etc. - the library handles SVG
 * drawing, axes and tooltips for us.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { formatMoney, formatMoneyShort } from "@/lib/currency";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  SkeletonBlock,
  StatCard,
} from "@/components/ui";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Sparkles,
  Flame,
  CheckCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Types describing exactly what /api/dashboard returns. */
interface DashboardData {
  user: { name: string; monthlyIncomeTarget: number | null; monthlySavingsTarget: number | null };
  stats: {
    monthIncome: number;
    monthExpense: number;
    monthSaved: number;
    savingsRate: number;
    netWorth: number;
    habitsDoneToday: number;
    habitsActiveTotal: number;
  };
  charts: {
    monthlySeries: { month: string; income: number; expense: number }[];
    categoryBreakdown: { category: string; total: number }[];
    netWorthSeries: { month: string; netWorth: number }[];
  };
  dueToday: { id: number; name: string; frequency: string }[];
  habitSummary: { id: number; name: string; doneThisPeriod: boolean; currentStreak: number; isActive: boolean }[];
  goals: { id: number; title: string; targetAmount: number; currentAmount: number; percentComplete: number }[];
  recentTransactions: { id: number; type: "income" | "expense"; category: string; amount: number; date: string; note: string | null }[];
  insights: string[];
}

const DONUT_COLORS = ["#0d7a5f", "#d9a13b", "#3d7dd8", "#d6455b", "#7c5cc4", "#e07b39", "#4aa8a0", "#9aa5b1"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // useCallback memoizes the function so the bell/other effects can reuse it.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<DashboardData>("/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- the three states every page must handle: loading, error, empty ----
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
        <SkeletonBlock lines={4} />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorBanner message={error ?? "No data."} onRetry={load} />;
  }

  const firstName = data.user.name.split(" ")[0];
  const hasActivity =
    data.stats.monthIncome > 0 ||
    data.stats.monthExpense > 0 ||
    data.habitSummary.length > 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Hi {firstName}, keep the chain alive
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Here is your money picture for this month.
          </p>
        </div>
        {data.dueToday.length > 0 && (
          <Link href="/habits">
            <Badge tone="gold">
              <Flame size={12} /> {data.dueToday.length} habit{data.dueToday.length > 1 ? "s" : ""} due today
            </Badge>
          </Link>
        )}
      </div>

      {!hasActivity && (
        <EmptyState
          title="Your dashboard is waiting for data"
          hint="Log your first expense or income, add a habit, and this page will come alive with charts and insights."
          action={
            <Link href="/transactions">
              <Button>Add your first transaction</Button>
            </Link>
          }
        />
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income this month" value={formatMoney(data.stats.monthIncome)} icon={<ArrowUpCircle size={19} />} tone="sky" />
        <StatCard label="Spent this month" value={formatMoney(data.stats.monthExpense)} icon={<ArrowDownCircle size={19} />} tone="rose" />
        <StatCard
          label="Saved this month"
          value={formatMoney(data.stats.monthSaved)}
          caption={`${data.stats.savingsRate}% savings rate`}
          icon={<Wallet size={19} />}
          tone="leaf"
        />
        <StatCard label="Net worth" value={formatMoney(data.stats.netWorth)} icon={<TrendingUp size={19} />} tone="gold" />
      </div>

      {/* Insights */}
      <Card className="border-gold/40 bg-gradient-to-br from-gold-soft to-card">
        <CardTitle title="Your insights" hint="Simple rules, not AI - see src/lib/insights.ts" />
        <ul className="space-y-2.5">
          {data.insights.map((message, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-gold" />
              {message}
            </li>
          ))}
        </ul>
      </Card>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle title="Income vs expenses" hint="Last 6 months" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.monthlySeries} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e4de" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoneyShort(Number(v))} width={56} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }}
                />
                <Bar dataKey="income" name="Income" fill="#3d7dd8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#d6455b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle title="Spending by category" hint="This month" />
          {data.charts.categoryBreakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">No expenses logged this month yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.categoryBreakdown}
                    dataKey="total"
                    nameKey="category"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={3}
                  >
                    {data.charts.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-1 space-y-1.5">
            {data.charts.categoryBreakdown.slice(0, 4).map((row, i) => (
              <li key={row.category} className="flex items-center justify-between text-xs text-ink-soft">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  {row.category}
                </span>
                {formatMoney(row.total)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Habits + goals + recent + net worth */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title="Today's habits" hint={`${data.stats.habitsDoneToday}/${data.stats.habitsActiveTotal} active habits done`} />
          {data.habitSummary.filter((h) => h.isActive).length === 0 ? (
            <EmptyState title="No habits yet" hint="Create your first money habit to start a streak." action={<Link href="/habits"><Button variant="soft">Open habit tracker</Button></Link>} />
          ) : (
            <ul className="space-y-2">
              {data.habitSummary.filter((h) => h.isActive).slice(0, 5).map((habit) => (
                <li key={habit.id} className="flex items-center justify-between rounded-xl bg-paper px-3.5 py-2.5">
                  <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                    <CheckCircle2 size={17} className={habit.doneThisPeriod ? "text-leaf" : "text-line"} />
                    {habit.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-gold">
                    <Flame size={13} /> {habit.currentStreak}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/habits" className="mt-3 inline-block text-xs font-semibold text-leaf hover:underline">
            Open habit tracker →
          </Link>
        </Card>

        <Card>
          <CardTitle title="Savings goals" hint="Top active goals" />
          {data.goals.length === 0 ? (
            <EmptyState title="No goals yet" hint="An emergency fund is a great first goal." action={<Link href="/goals"><Button variant="soft">Create a goal</Button></Link>} />
          ) : (
            <ul className="space-y-4">
              {data.goals.map((goal) => (
                <li key={goal.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{goal.title}</span>
                    <span className="text-xs text-ink-soft">
                      {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
                    </span>
                  </div>
                  <ProgressBar percent={goal.percentComplete} tone={goal.percentComplete >= 100 ? "gold" : "leaf"} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/goals" className="mt-3 inline-block text-xs font-semibold text-leaf hover:underline">
            Manage goals →
          </Link>
        </Card>

        <Card>
          <CardTitle title="Net worth growth" hint="Monthly snapshots" />
          {data.charts.netWorthSeries.length < 2 ? (
            <p className="py-10 text-center text-sm text-ink-faint">
              Snapshots appear as you log data - check back next month for a trend line.
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.netWorthSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e4de" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoneyShort(Number(v))} width={56} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                  <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#0d7a5f" strokeWidth={2.5} dot={{ r: 3, fill: "#0d7a5f" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <Link href="/wealth" className="mt-3 inline-block text-xs font-semibold text-leaf hover:underline">
            Open wealth analytics →
          </Link>
        </Card>

        <Card>
          <CardTitle title="Recent activity" hint="Latest 5 records" />
          {data.recentTransactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.note || t.category}</p>
                    <p className="text-xs text-ink-faint">{t.category} · {t.date}</p>
                  </div>
                  <span className={`text-sm font-bold ${t.type === "income" ? "text-leaf" : "text-rose"}`}>
                    {t.type === "income" ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/transactions" className="mt-3 inline-block text-xs font-semibold text-leaf hover:underline">
            See all transactions →
          </Link>
        </Card>
      </div>
    </div>
  );
}
