"use client";

/**
 * SHARED UI KIT
 * =============
 * Small reusable building blocks (buttons, cards, inputs, empty states...)
 * so every page looks consistent and page files stay short and readable.
 * These are ordinary React components - no magic, just props and Tailwind.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";

/* ---------- layout primitives ---------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rise-in rounded-2xl border border-line bg-card p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </header>
  );
}

/* ---------- buttons & form controls ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
  busy?: boolean;
};

export function Button({
  variant = "primary",
  busy = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    primary: "bg-leaf text-white hover:bg-leaf-deep",
    soft: "bg-leaf-soft text-leaf hover:bg-leaf/20",
    ghost: "border border-line bg-card text-ink hover:border-leaf hover:text-leaf",
    danger: "bg-rose-soft text-rose hover:bg-rose/20",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leaf focus:bg-card";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={3} className={`${inputClass} ${props.className ?? ""}`} />;
}

/* ---------- feedback states: every page should show all three ---------- */

/** Shown while data is loading - a shimmering placeholder, not a blank page. */
export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

/** Shown when a request failed. Always offers a way to recover. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose-soft p-4 text-sm text-rose">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-0.5 opacity-80">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="rounded-lg bg-rose px-3 py-1.5 text-xs font-bold text-white">
          Retry
        </button>
      )}
    </div>
  );
}

/** Shown when there's simply nothing to display yet. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-paper px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-leaf-soft text-leaf">
        <Inbox size={20} />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Inline success / error flash message under forms. */
export function Flash({ kind, text }: { kind: "success" | "error"; text: string | null }) {
  if (!text) return null;
  return (
    <p
      className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${
        kind === "success" ? "bg-leaf-soft text-leaf" : "bg-rose-soft text-rose"
      }`}
    >
      {text}
    </p>
  );
}

/* ---------- misc ---------- */

export function ProgressBar({ percent, tone = "leaf" }: { percent: number; tone?: "leaf" | "gold" | "rose" }) {
  const color = { leaf: "bg-leaf", gold: "bg-gold", rose: "bg-rose" }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-line/70">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "leaf",
}: {
  children: ReactNode;
  tone?: "leaf" | "gold" | "rose" | "sky" | "plain";
}) {
  const styles = {
    leaf: "bg-leaf-soft text-leaf",
    gold: "bg-gold-soft text-gold",
    rose: "bg-rose-soft text-rose",
    sky: "bg-sky-soft text-sky",
    plain: "bg-line/60 text-ink-soft",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${styles}`}>
      {children}
    </span>
  );
}

/** Simple centered modal dialog. onClose fires on backdrop click / X. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="rise-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Stat card used on dashboards: label + big number + optional caption. */
export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = "leaf",
}: {
  label: string;
  value: string;
  caption?: string;
  icon: ReactNode;
  tone?: "leaf" | "gold" | "rose" | "sky";
}) {
  const tones = {
    leaf: "bg-leaf-soft text-leaf",
    gold: "bg-gold-soft text-gold",
    rose: "bg-rose-soft text-rose",
    sky: "bg-sky-soft text-sky",
  }[tone];
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
        {caption && <p className="mt-1 text-xs text-ink-soft">{caption}</p>}
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones}`}>{icon}</span>
    </Card>
  );
}
