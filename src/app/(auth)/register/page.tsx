"use client";

/**
 * REGISTER PAGE - client-side validation first (instant feedback, no server
 * round trip for obvious mistakes), then POST /api/auth/register.
 * The server validates AGAIN - never trust the browser, anyone can bypass
 * JavaScript. This double-check pattern is intentional, not duplicated work.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { Button, Field, Flash, Input } from "@/components/ui";
import { Sprout } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // ----- friendly client-side checks -----
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("That doesn't look like a valid email address.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setBusy(true);
    try {
      await api.post("/auth/register", { name, email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf">
            <Sprout className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold text-ink">HabitWealth</span>
        </div>
        <h2 className="text-2xl font-bold text-ink">Create your account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Start building money habits in under a minute.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Flash kind="error" text={error} />
          <Field label="Full name">
            <Input placeholder="Priya Sharma" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password (min 8 characters)">
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <Input type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" busy={busy} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-leaf hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
