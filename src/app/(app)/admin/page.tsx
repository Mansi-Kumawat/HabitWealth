"use client";

/**
 * ADMIN PANEL (role: admin only - enforced by middleware AND the API)
 * ===================================================================
 * Three tabs:
 *  - Overview: platform KPIs (users, DAU/WAU/MAU, habit completion rate,
 *    engagement...) + monthly activity chart + CSV download.
 *  - Users: search, activate/deactivate. Only summary counts are shown -
 *    admins never see anyone's money details (privacy by design).
 *  - Feedback: ticket queue with status filters, admin reply + status change.
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Select,
  SkeletonBlock,
  StatCard,
  Textarea,
} from "@/components/ui";
import { Users, Activity, Flame, Target, Download, MessageSquare } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnalyticsData {
  totalUsers: number; newUsersThisMonth: number; totalTransactions: number;
  habitsCompletedToday: number; openTickets: number;
  dau: number; wau: number; mau: number;
  habitCompletionRate: number; avgGoalCompletion: number; engagementRate: number;
  monthlyActivity: { month: string; transactions: number }[];
}
interface AdminUserRow {
  id: number; name: string; email: string; role: string; isActive: boolean;
  occupation: string | null; createdAt: string;
  transactionCount: number; habitCount: number; goalCount: number;
}
interface TicketRow {
  id: number; subject: string; message: string; status: string;
  adminNote: string | null; createdAt: string; userName: string | null; userEmail: string | null;
}

type Tab = "overview" | "users" | "feedback";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics(await api.get<AnalyticsData>("/admin/analytics")); }
    catch { setAnalytics(null); }
  }, []);

  const loadUsers = useCallback(async (q: string) => {
    try { setUsers(await api.get<AdminUserRow[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed to load users."); }
  }, []);

  const loadTickets = useCallback(async (status: string) => {
    try { setTickets(await api.get<TicketRow[]>(`/admin/feedback${status ? `?status=${status}` : ""}`)); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed to load tickets."); }
  }, []);

  useEffect(() => { loadAnalytics(); loadUsers(""); loadTickets(""); }, [loadAnalytics, loadUsers, loadTickets]);

  // Re-search when the admin types (small debounce so we don't spam the API).
  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(search), 300);
    return () => window.clearTimeout(timer);
  }, [search, loadUsers]);

  useEffect(() => { loadTickets(statusFilter); }, [statusFilter, loadTickets]);

  async function toggleUser(user: AdminUserRow) {
    try {
      await api.put(`/admin/users/${user.id}`, { isActive: !user.isActive });
      loadUsers(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function saveTicket(ticket: TicketRow, status: string) {
    try {
      await api.put(`/admin/feedback/${ticket.id}`, {
        status,
        adminNote: replyDrafts[ticket.id] ?? ticket.adminNote ?? "",
      });
      setReplyDrafts((drafts) => ({ ...drafts, [ticket.id]: "" }));
      loadTickets(statusFilter);
      loadAnalytics(); // open-ticket count changes
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Admin Panel</h1>
        <p className="mt-1 text-sm text-ink-soft">Platform health at a glance - user finances stay private.</p>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}

      {/* Tab bar */}
      <div className="flex gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === id ? "bg-forest text-white" : "border border-line bg-card text-ink-soft hover:text-ink"
            }`}
          >
            <Icon size={15} /> {label}
            {id === "feedback" && analytics && analytics.openTickets > 0 && (
              <span className="rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">{analytics.openTickets}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---- OVERVIEW TAB ---- */}
      {tab === "overview" && (
        !analytics ? <SkeletonBlock lines={5} /> : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total users" value={String(analytics.totalUsers)} caption={`+${analytics.newUsersThisMonth} this month`} icon={<Users size={19} />} tone="sky" />
              <StatCard label="Transactions logged" value={String(analytics.totalTransactions)} icon={<Activity size={19} />} tone="leaf" />
              <StatCard label="Habits done today" value={String(analytics.habitsCompletedToday)} caption={`${analytics.habitCompletionRate}% completion rate`} icon={<Flame size={19} />} tone="gold" />
              <StatCard label="Avg goal completion" value={`${analytics.avgGoalCompletion}%`} icon={<Target size={19} />} tone="rose" />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "DAU (24h)", value: analytics.dau },
                { label: "WAU (7d)", value: analytics.wau },
                { label: "MAU (30d)", value: analytics.mau },
                { label: "Engagement (WAU/users)", value: `${analytics.engagementRate}%` },
              ].map((kpi) => (
                <Card key={kpi.label} className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{kpi.label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{kpi.value}</p>
                </Card>
              ))}
            </div>
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <CardTitle title="Monthly financial activity" hint="Transactions logged across the platform" />
                <a href="/api/admin/analytics?format=csv" className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink hover:border-leaf hover:text-leaf">
                  <Download size={13} /> CSV report
                </a>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.monthlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e4de" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#5c6b63" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e6e4de", fontSize: 13 }} />
                    <Bar dataKey="transactions" name="Transactions" fill="#0d7a5f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )
      )}

      {/* ---- USERS TAB ---- */}
      {tab === "users" && (
        <div className="space-y-4">
          <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {!users ? <SkeletonBlock lines={4} /> : users.length === 0 ? (
            <EmptyState title="No users match" hint="Try a different search term." />
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-line">
                {users.map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {user.name}
                        {user.role === "admin" && <Badge tone="gold">admin</Badge>}
                        {!user.isActive && <Badge tone="rose">deactivated</Badge>}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {user.email} · {user.occupation || "occupation not set"} · joined {new Date(user.createdAt).toLocaleDateString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {user.transactionCount} transactions · {user.habitCount} habits · {user.goalCount} goals
                      </p>
                    </div>
                    {user.role !== "admin" && (
                      <Button variant={user.isActive ? "danger" : "soft"} onClick={() => toggleUser(user)}>
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ---- FEEDBACK TAB ---- */}
      {tab === "feedback" && (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </Select>
          </div>
          {!tickets ? <SkeletonBlock lines={4} /> : tickets.length === 0 ? (
            <EmptyState title="Queue is empty" hint="No tickets with this status. Nice work!" />
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{ticket.subject}</p>
                    <Badge tone={ticket.status === "resolved" ? "leaf" : ticket.status === "in_progress" ? "sky" : "gold"}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    from {ticket.userName ?? "unknown"} ({ticket.userEmail ?? "no email"}) · {new Date(ticket.createdAt).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-2 rounded-xl bg-paper px-3.5 py-2.5 text-sm text-ink">{ticket.message}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                    <Field label="Admin reply (user sees this)">
                      <Textarea
                        placeholder="Thanks for reporting! We're looking into it..."
                        value={replyDrafts[ticket.id] ?? ticket.adminNote ?? ""}
                        onChange={(e) => setReplyDrafts((d) => ({ ...d, [ticket.id]: e.target.value }))}
                      />
                    </Field>
                    <div className="flex items-end gap-2 sm:col-span-3">
                      {(["open", "in_progress", "resolved"] as const).map((status) => (
                        <Button
                          key={status}
                          variant={ticket.status === status ? "primary" : "ghost"}
                          onClick={() => saveTicket(ticket, status)}
                          className="capitalize"
                        >
                          {status.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
