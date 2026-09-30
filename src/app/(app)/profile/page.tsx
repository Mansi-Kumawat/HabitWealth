"use client";

/**
 * PROFILE & SUPPORT PAGE
 * ======================
 * Three sections:
 *  1. Financial profile - contact details, occupation, monthly income and
 *     savings targets, and free-text financial goals.
 *  2. Income sources - Salary / Freelance / Stipend with amount + frequency.
 *  3. Help & feedback - report an issue or complaint; below the form you can
 *     see your past tickets and any admin replies.
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
  Select,
  SkeletonBlock,
  Textarea,
} from "@/components/ui";
import { PlusCircle, Trash2 } from "lucide-react";

interface ProfileData {
  name: string; email: string; phone: string | null; occupation: string | null;
  monthlyIncomeTarget: number | null; monthlySavingsTarget: number | null;
  financialGoalsText: string | null;
}
interface SourceRow { id: number; name: string; amount: number; frequency: string }
interface TicketRow { id: number; subject: string; message: string; status: string; adminNote: string | null; createdAt: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [sourceName, setSourceName] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [sourceFrequency, setSourceFrequency] = useState("monthly");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [me, srcs, myTickets] = await Promise.all([
        api.get<ProfileData>("/users/profile"),
        api.get<SourceRow[]>("/income-sources"),
        api.get<TicketRow[]>("/feedback"),
      ]);
      setProfile(me);
      setSources(srcs);
      setTickets(myTickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flashMessage(kind: "success" | "error", text: string) {
    setFlash({ kind, text });
    if (kind === "success") window.setTimeout(() => setFlash(null), 4000);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setProfileBusy(true);
    try {
      await api.put("/users/profile", {
        ...profile,
        monthlyIncomeTarget: Number(profile.monthlyIncomeTarget ?? 0),
        monthlySavingsTarget: Number(profile.monthlySavingsTarget ?? 0),
      });
      flashMessage("success", "Profile saved.");
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function addSource(event: FormEvent) {
    event.preventDefault();
    if (!sourceName.trim() || !sourceAmount || Number(sourceAmount) <= 0)
      return flashMessage("error", "Enter a source name and a positive amount.");
    try {
      await api.post("/income-sources", { name: sourceName, amount: Number(sourceAmount), frequency: sourceFrequency });
      setSourceName(""); setSourceAmount("");
      flashMessage("success", "Income source added.");
      const srcs = await api.get<SourceRow[]>("/income-sources");
      setSources(srcs);
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Could not add source.");
    }
  }

  async function removeSource(source: SourceRow) {
    try {
      await api.del(`/income-sources/${source.id}`);
      setSources((prev) => prev?.filter((s) => s.id !== source.id) ?? null);
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !message.trim())
      return flashMessage("error", "Please fill in both the subject and the message.");
    setTicketBusy(true);
    try {
      await api.post("/feedback", { subject, message });
      setSubject(""); setMessage("");
      flashMessage("success", "Thanks! Your ticket was submitted.");
      setTickets(await api.get<TicketRow[]>("/feedback"));
    } catch (err) {
      flashMessage("error", err instanceof ApiError ? err.message : "Submit failed.");
    } finally {
      setTicketBusy(false);
    }
  }

  const statusTone = (status: string) =>
    status === "resolved" ? "leaf" : status === "in_progress" ? "sky" : "gold";

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!profile || !sources || !tickets) return <SkeletonBlock lines={6} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profile & Support</h1>
        <p className="mt-1 text-sm text-ink-soft">Who you are, where money comes from, and how to reach us.</p>
      </div>
      {flash && <Flash kind={flash.kind} text={flash.text} />}

      {/* Financial profile */}
      <Card>
        <CardTitle title="Financial profile" hint="Used to personalise your dashboard (targets, insights)" />
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label="Email (login)">
            <Input value={profile.email} disabled className="opacity-60" />
          </Field>
          <Field label="Phone">
            <Input placeholder="+91 98765 43210" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <Field label="Occupation">
            <Input placeholder="Student / Software Engineer / Freelancer" value={profile.occupation ?? ""} onChange={(e) => setProfile({ ...profile, occupation: e.target.value })} />
          </Field>
          <Field label="Monthly income target (₹)">
            <Input type="number" min="0" placeholder="50000" value={profile.monthlyIncomeTarget ?? ""} onChange={(e) => setProfile({ ...profile, monthlyIncomeTarget: Number(e.target.value) })} />
          </Field>
          <Field label="Monthly savings target (₹)">
            <Input type="number" min="0" placeholder="10000" value={profile.monthlySavingsTarget ?? ""} onChange={(e) => setProfile({ ...profile, monthlySavingsTarget: Number(e.target.value) })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="My financial goals (free text)">
              <Textarea placeholder="Build a 6-month emergency fund, then start a ₹5,000/month SIP..." value={profile.financialGoalsText ?? ""} onChange={(e) => setProfile({ ...profile, financialGoalsText: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" busy={profileBusy}>Save profile</Button>
          </div>
        </form>
      </Card>

      {/* Income sources */}
      <Card>
        <CardTitle title="Income sources" hint="Where your money comes from" />
        <form onSubmit={addSource} className="mb-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder="Salary" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
          <Input type="number" min="0" placeholder="42000" value={sourceAmount} onChange={(e) => setSourceAmount(e.target.value)} />
          <Select value={sourceFrequency} onChange={(e) => setSourceFrequency(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
            <option value="one-time">One-time</option>
          </Select>
          <Button type="submit" variant="soft"><PlusCircle size={15} /> Add source</Button>
        </form>
        {sources.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-faint">No income sources yet - add your salary, stipend or freelance gigs.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{source.name}</p>
                  <p className="text-xs text-ink-faint">{formatMoney(source.amount)} · {source.frequency}</p>
                </div>
                <button onClick={() => removeSource(source)} className="rounded-lg p-2 text-ink-faint hover:bg-rose-soft hover:text-rose" aria-label="Delete source">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Feedback / complaints */}
      <Card>
        <CardTitle title="Report an issue or share feedback" hint="Tracked as a ticket - an admin will reply here" />
        <form onSubmit={submitTicket} className="space-y-3">
          <Field label="Subject">
            <Input placeholder="CSV report shows wrong month" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea placeholder="Describe what happened and what you expected..." value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <Button type="submit" busy={ticketBusy}>Submit ticket</Button>
        </form>
      </Card>

      <Card>
        <CardTitle title="My tickets" hint="Your issues and the admin's replies" />
        {tickets.length === 0 ? (
          <EmptyState title="No tickets yet" hint="Everything running smoothly? Great!" />
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-xl bg-paper p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{ticket.subject}</p>
                  <Badge tone={statusTone(ticket.status)}>{ticket.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{ticket.message}</p>
                {ticket.adminNote && (
                  <p className="mt-2 rounded-lg bg-leaf-soft px-3 py-2 text-sm text-leaf">
                    <span className="font-semibold">Admin reply:</span> {ticket.adminNote}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {new Date(ticket.createdAt).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
