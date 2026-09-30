"use client";

/**
 * HABIT TRACKER
 * =============
 * Features on this page:
 *  - One-click preset templates ("Save ₹100 daily", "No-spend day weekly"...)
 *  - Create your own habit (name / type / frequency / optional target)
 *  - "Mark done" for the current period (server enforces one log per period)
 *  - Current + longest streaks (computed server-side from the logs)
 *  - A 30-day mini heatmap grid (green = completed that day)
 *  - Pause / resume and delete
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Flash,
  Input,
  Select,
  SkeletonBlock,
} from "@/components/ui";
import { Flame, CheckCircle2, Pause, Play, Trash2, Zap } from "lucide-react";

interface HabitRow {
  id: number;
  name: string;
  type: string;
  frequency: "daily" | "weekly" | "monthly";
  targetAmount: number | null;
  reminderTime: string | null;
  isActive: boolean;
  doneThisPeriod: boolean;
  currentStreak: number;
  longestStreak: number;
  completionRate30: number;
  history30: { date: string; done: boolean }[];
}
interface HabitsData {
  habits: HabitRow[];
  dueToday: HabitRow[];
  presets: { name: string; type: string; frequency: string; targetAmount: number | null }[];
}

export default function HabitsPage() {
  const [data, setData] = useState<HabitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("saving");
  const [frequency, setFrequency] = useState("daily");
  const [targetAmount, setTargetAmount] = useState("");
  const [reminderTime, setReminderTime] = useState("21:00");
  const [formBusy, setFormBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<HabitsData>("/habits"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load habits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flashMessage(kind: "success" | "error", text: string) {
    setFlash({ kind, text });
    if (kind === "success") window.setTimeout(() => setFlash(null), 4000);
  }

  async function createHabit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return flashMessage("error", "Please give your habit a name.");
    setFormBusy(true);
    try {
      await api.post("/habits", {
        name, type, frequency,
        targetAmount: targetAmount ? Number(targetAmount) : null,
        reminderTime,
      });
      setName(""); setTargetAmount("");
      flashMessage("success", "Habit created - today is day one!");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Could not create habit.");
    } finally {
      setFormBusy(false);
    }
  }

  // Presets go through the SAME create endpoint - no special code path.
  async function addPreset(preset: HabitsData["presets"][number]) {
    try {
      await api.post("/habits", { ...preset, reminderTime: "21:00" });
      flashMessage("success", `"${preset.name}" added. Go get that streak!`);
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Could not add preset.");
    }
  }

  async function markDone(habit: HabitRow) {
    setBusyId(habit.id);
    try {
      await api.post("/habits/complete", { habitId: habit.id });
      flashMessage("success", `Well done! "${habit.name}" completed.`);
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Could not complete.");
    } finally {
      setBusyId(null);
    }
  }

  async function togglePause(habit: HabitRow) {
    try {
      await api.put(`/habits/${habit.id}`, { isActive: !habit.isActive });
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function removeHabit(habit: HabitRow) {
    if (!window.confirm(`Delete "${habit.name}" and its whole history?`)) return;
    try {
      await api.del(`/habits/${habit.id}`);
      flashMessage("success", "Habit deleted.");
      load();
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  if (loading && !data) return <SkeletonBlock lines={5} />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Habit Tracker</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Small actions, repeated. Streaks turn intentions into wealth.
        </p>
      </div>

      {/* "Due today" reminder banner - the in-app reminder required by the spec */}
      {data && data.dueToday.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold-soft p-4">
          <Zap size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-sm text-ink">
            <span className="font-semibold">Due today:</span>{" "}
            {data.dueToday.map((h) => h.name).join(", ")}. Mark them done below to
            keep your streaks alive.
          </p>
        </div>
      )}
      {flash && <Flash kind={flash.kind} text={flash.text} />}

      {/* One-click presets */}
      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Start instantly with a template
        </p>
        <div className="flex flex-wrap gap-2">
          {data?.presets.map((preset) => (
            <Button key={preset.name} variant="soft" onClick={() => addPreset(preset)}>
              <Zap size={13} /> {preset.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Create form */}
      <Card>
        <p className="mb-4 text-[15px] font-semibold text-ink">Create your own habit</p>
        <form onSubmit={createHabit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Name">
            <Input placeholder="Save ₹100 daily" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="saving">Saving</option>
              <option value="budgeting">Budgeting</option>
              <option value="investing">Investing</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Frequency">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
          <Field label="Target ₹ (optional)">
            <Input type="number" min="0" placeholder="100" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </Field>
          <Field label="Reminder time">
            <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit" busy={formBusy}>Create habit</Button>
          </div>
        </form>
      </Card>

      {/* Habit cards */}
      {data && data.habits.length === 0 && (
        <EmptyState
          title="No habits yet"
          hint="Pick a template above or create your own. One period at a time - that's the whole secret."
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.habits.map((habit) => (
          <Card key={habit.id} className={habit.isActive ? "" : "opacity-60"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{habit.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="plain">{habit.frequency}</Badge>
                  <Badge tone="plain">{habit.type}</Badge>
                  {!habit.isActive && <Badge tone="rose">paused</Badge>}
                  {habit.targetAmount && <Badge tone="gold">₹{habit.targetAmount}/period</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePause(habit)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-paper hover:text-ink" title={habit.isActive ? "Pause" : "Resume"}>
                  {habit.isActive ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button onClick={() => removeHabit(habit)} className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Streak numbers */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-gold-soft p-3">
                <p className="flex items-center justify-center gap-1 text-lg font-bold text-ink">
                  <Flame size={16} className="text-gold" /> {habit.currentStreak}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">current</p>
              </div>
              <div className="rounded-xl bg-leaf-soft p-3">
                <p className="text-lg font-bold text-ink">{habit.longestStreak}</p>
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">best</p>
              </div>
              <div className="rounded-xl bg-sky-soft p-3">
                <p className="text-lg font-bold text-ink">{Math.round(habit.completionRate30)}%</p>
                <p className="text-[11px] uppercase tracking-wide text-ink-soft">30-day rate</p>
              </div>
            </div>

            {/* 30-day heatmap: one square per day, green = done */}
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Last 30 days</p>
              <div className="grid grid-cols-10 gap-1">
                {habit.history30.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date}${day.done ? " - done" : ""}`}
                    className={`aspect-square rounded-[4px] ${day.done ? "bg-leaf" : "bg-line/60"}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4">
              {habit.doneThisPeriod ? (
                <p className="flex items-center justify-center gap-2 rounded-xl bg-leaf-soft py-2.5 text-sm font-semibold text-leaf">
                  <CheckCircle2 size={16} /> Done for this {habit.frequency} period
                </p>
              ) : (
                <Button
                  className="w-full"
                  busy={busyId === habit.id}
                  disabled={!habit.isActive}
                  onClick={() => markDone(habit)}
                >
                  <CheckCircle2 size={16} />
                  Mark done {habit.frequency === "daily" ? "today" : `this ${habit.frequency.replace("ly", "")}`}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
