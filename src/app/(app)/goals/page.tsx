"use client";

/**
 * SAVINGS GOALS PAGE
 * ==================
 * Create goals (Emergency Fund, Goa Trip...), then add or withdraw
 * contributions. Each card shows: % complete progress bar, an
 * on-track / behind / done indicator (based on the deadline), estimated
 * completion date from your saving pace, and the full contribution history
 * in a modal. Reaching the target auto-marks the goal completed.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client";
import { formatMoney } from "@/lib/currency";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Flash,
  Input,
  Modal,
  ProgressBar,
  Select,
  SkeletonBlock,
} from "@/components/ui";
import { History, Target, Trash2, Trophy } from "lucide-react";

interface GoalRow {
  id: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  priority: string;
  status: "active" | "completed";
  percentComplete: number;
  pace: "on-track" | "behind" | "done";
  monthlyPace: number;
  estimatedCompletion: string | null;
}
interface ContributionRow { id: number; amount: number; note: string | null; createdAt: string }

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [formBusy, setFormBusy] = useState(false);

  // Which goal's money/history modal is open (null = none).
  const [moneyGoal, setMoneyGoal] = useState<GoalRow | null>(null);
  const [historyGoal, setHistoryGoal] = useState<GoalRow | null>(null);
  const [history, setHistory] = useState<ContributionRow[]>([]);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyAction, setMoneyAction] = useState<"add" | "withdraw">("add");
  const [moneyBusy, setMoneyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGoals(await api.get<GoalRow[]>("/goals"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flashMessage(kind: "success" | "error", text: string) {
    setFlash({ kind, text });
    if (kind === "success") window.setTimeout(() => setFlash(null), 5000);
  }

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return flashMessage("error", "Please give the goal a title.");
    if (!target || Number(target) <= 0) return flashMessage("error", "Target amount must be positive.");
    setFormBusy(true);
    try {
      await api.post("/goals", { title, targetAmount: Number(target), deadline: deadline || null, priority });
      setTitle(""); setTarget(""); setDeadline("");
      flashMessage("success", "Goal created - a dream with a deadline.");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Could not create goal.");
    } finally {
      setFormBusy(false);
    }
  }

  async function saveContribution(event: FormEvent) {
    event.preventDefault();
    if (!moneyGoal) return;
    if (!moneyAmount || Number(moneyAmount) <= 0)
      return flashMessage("error", "Enter an amount greater than zero.");
    setMoneyBusy(true);
    try {
      const message = await api
        .post(`/goals/${moneyGoal.id}/contributions`, { amount: Number(moneyAmount), action: moneyAction })
        .then(() => moneyAction === "withdraw" ? "Withdrawal recorded." : "Contribution added!");
      setMoneyGoal(null);
      setMoneyAmount("");
      flashMessage("success", message);
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setMoneyBusy(false);
    }
  }

  async function openHistory(goal: GoalRow) {
    setHistoryGoal(goal);
    setHistory([]);
    try {
      setHistory(await api.get<ContributionRow[]>(`/goals/${goal.id}/contributions`));
    } catch { /* modal shows its own empty state */ }
  }

  async function removeGoal(goal: GoalRow) {
    if (!window.confirm(`Delete goal "${goal.title}" and its history?`)) return;
    try {
      await api.del(`/goals/${goal.id}`);
      flashMessage("success", "Goal deleted.");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  const paceBadge = (goal: GoalRow) => {
    if (goal.pace === "done") return <Badge tone="gold"><Trophy size={11} /> done</Badge>;
    if (goal.pace === "on-track") return <Badge tone="leaf">on track</Badge>;
    return <Badge tone="rose">behind</Badge>;
  };

  if (loading && !goals) return <SkeletonBlock lines={4} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const activeGoals = goals?.filter((g) => g.status === "active") ?? [];
  const completedGoals = goals?.filter((g) => g.status === "completed") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Savings Goals</h1>
        <p className="mt-1 text-sm text-ink-soft">Give every rupee a job and a destination.</p>
      </div>
      {flash && <Flash kind={flash.kind} text={flash.text} />}

      {/* Create form */}
      <Card>
        <p className="mb-4 text-[15px] font-semibold text-ink">Create a new goal</p>
        <form onSubmit={createGoal} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Title">
            <Input placeholder="Emergency Fund" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Target amount (₹)">
            <Input type="number" min="0" step="0.01" placeholder="50000" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Deadline (optional)">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" busy={formBusy}><Target size={15} /> Create goal</Button>
          </div>
        </form>
      </Card>

      {goals && goals.length === 0 && (
        <EmptyState title="No goals yet" hint="Start with an emergency fund of 3-6 months of expenses - it makes every other goal less scary." />
      )}

      {/* Active goals */}
      <div className="grid gap-4 lg:grid-cols-2">
        {activeGoals.map((goal) => (
          <Card key={goal.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{goal.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {paceBadge(goal)}
                  <Badge tone="plain">{goal.priority} priority</Badge>
                  {goal.deadline && <Badge tone="sky">due {goal.deadline}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openHistory(goal)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-paper hover:text-ink" title="History">
                  <History size={15} />
                </button>
                <button onClick={() => removeGoal(goal)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <p className="text-xl font-bold text-ink">{formatMoney(goal.currentAmount)}</p>
              <p className="text-xs text-ink-soft">of {formatMoney(goal.targetAmount)} · {Math.round(goal.percentComplete)}%</p>
            </div>
            <div className="mt-2"><ProgressBar percent={goal.percentComplete} /></div>

            <p className="mt-2 text-xs text-ink-faint">
              {goal.estimatedCompletion
                ? goal.estimatedCompletion === "Already reached"
                  ? "Target reached!"
                  : `At ~${formatMoney(goal.monthlyPace)}/month you'll finish around ${goal.estimatedCompletion}.`
                : "Add a contribution to see an estimated finish date."}
            </p>

            <div className="mt-4 flex gap-2">
              <Button variant="soft" className="flex-1" onClick={() => { setMoneyGoal(goal); setMoneyAction("add"); }}>
                Add money
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => { setMoneyGoal(goal); setMoneyAction("withdraw"); }}>
                Withdraw
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Completed goals</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedGoals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{goal.title}</p>
                  <p className="text-xs text-ink-soft">{formatMoney(goal.targetAmount)} achieved</p>
                </div>
                <Trophy size={18} className="text-gold" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / withdraw modal */}
      {moneyGoal && (
        <Modal
          title={`${moneyAction === "withdraw" ? "Withdraw from" : "Add to"} "${moneyGoal.title}"`}
          onClose={() => setMoneyGoal(null)}
        >
          <form onSubmit={saveContribution} className="space-y-4">
            <p className="text-sm text-ink-soft">
              Currently saved: <span className="font-semibold text-ink">{formatMoney(moneyGoal.currentAmount)}</span>
            </p>
            <Field label={`Amount to ${moneyAction === "withdraw" ? "withdraw" : "add"} (₹)`}>
              <Input type="number" min="0" step="0.01" autoFocus placeholder="2000" value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" busy={moneyBusy} className="flex-1">
                {moneyAction === "withdraw" ? "Withdraw" : "Add contribution"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMoneyGoal(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* History modal */}
      {historyGoal && (
        <Modal title={`History - "${historyGoal.title}"`} onClose={() => setHistoryGoal(null)}>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No contributions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-ink-soft">{new Date(row.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className={`font-bold ${row.amount >= 0 ? "text-leaf" : "text-rose"}`}>
                    {row.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(row.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
