import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * 404 PAGE - Next.js shows this automatically for unknown URLs.
 * Always give lost users a clear way back.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-soft text-leaf">
        <Compass size={30} />
      </span>
      <h1 className="mt-6 text-5xl font-bold tracking-tight text-ink">404</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        This page wandered off the budget. Let&apos;s get you back to tracking
        your money.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-leaf px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-deep"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
