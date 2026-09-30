"use client";

/**
 * LOGIN PAGE
 * ==========
 * Controlled form: every input's value lives in React state (useState) and
 * the input just displays that state. On submit we POST to /api/auth/login;
 * on success the server sets the session cookie and we navigate onward
 * (to the page the user originally wanted, or the dashboard).
 */
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { Button, Field, Flash, Input } from "@/components/ui";
import { Sprout, TrendingUp, PiggyBank, Target } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // stop the browser's full-page form reload
    setError(null);
    if (!email || !password) {
      setError("Please enter both your email and password.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      // "?next=" tells us where the user was headed before being bounced here.
      router.replace(searchParams.get("next") || "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Flash kind="error" text={error} />
      <Field label="Email">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" busy={busy} className="w-full">
        Log in
      </Button>
      <div className="rounded-xl bg-paper p-3 text-xs leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Demo accounts (seeded data)</p>
        <p>User: priya@example.com · Password: Demo@123</p>
        <p>Admin: admin@habitwealth.app · Password: Admin@123</p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-forest p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-leaf">
            <Sprout className="h-5.5 w-5.5 text-white" />
          </span>
          <span className="text-lg font-bold text-white">HabitWealth</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight text-white">
            Wealth isn&apos;t a number. It&apos;s a <span className="text-gold">habit</span>.
          </h1>
          <p className="mt-4 max-w-md text-white/60">
            Save a little every day, track where money goes, and watch your net
            worth grow month after month.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: PiggyBank, text: "Daily saving streaks that keep you honest" },
              { icon: TrendingUp, text: "Net worth snapshots showing real growth" },
              { icon: Target, text: "Goals with on-track indicators, not just bars" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={17} />
                </span>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40">Built for learners · MERN-style architecture on Next.js + PostgreSQL</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf">
              <Sprout className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-bold text-ink">HabitWealth</span>
          </div>
          <h2 className="text-2xl font-bold text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-soft">Log in to keep your streak alive.</p>
          <div className="mt-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-sm text-ink-soft">
            New here?{" "}
            <Link href="/register" className="font-semibold text-leaf hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
