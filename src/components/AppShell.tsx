"use client";

/**
 * AUTH CONTEXT + APP SHELL
 * ========================
 * CONTEXT (React concept): a way to share data (here: the logged-in user)
 * with EVERY component without passing props down 10 levels. Any component
 * can call `useAuth()` to read { user, loading, refresh, logout }.
 *
 * HOOKS (React concept): functions like useState/useEffect/useContext that
 * let components hold state and run side effects. Custom hooks (useAuth,
 * useRequireAuth) are just functions that call other hooks - the name must
 * start with "use".
 *
 * AppShell also draws the sidebar navigation, the mobile topbar, and the
 * notification bell listing habits not yet completed today.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CheckCircle2,
  Target,
  TrendingUp,
  UserRound,
  ShieldCheck,
  Bell,
  LogOut,
  Sprout,
  Menu,
  X,
} from "lucide-react";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  occupation: string | null;
  monthlySavingsTarget: number | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

/** The custom hook every page/component uses to read the session. */
export function useAuth() {
  return useContext(AuthContext);
}

interface DueHabit {
  id: number;
  name: string;
  frequency: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Expenses & Income", icon: ArrowLeftRight },
  { href: "/habits", label: "Habit Tracker", icon: CheckCircle2 },
  { href: "/goals", label: "Savings Goals", icon: Target },
  { href: "/wealth", label: "Wealth Analytics", icon: TrendingUp },
  { href: "/profile", label: "Profile & Support", icon: UserRound },
];

/** Wraps every app page: loads the session, draws the chrome (nav + bell). */
export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dueHabits, setDueHabits] = useState<DueHabit[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch "who am I?" once when the app boots. 401 -> middleware/login flow.
  const refresh = useCallback(async () => {
    try {
      const me = await api.get<SessionUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load habits due today for the notification bell (after we know the user).
  useEffect(() => {
    if (!user) return;
    api
      .get<{ dueToday: DueHabit[] }>("/habits")
      .then((data) => setDueHabits(data.dueToday))
      .catch(() => setDueHabits([]));
  }, [user, pathname]);

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    router.replace("/login");
  }

  // Full-screen loader while the session is being checked.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <Sprout className="h-10 w-10 animate-pulse text-leaf" />
          <p className="text-sm text-ink-soft">Loading your workspace...</p>
        </div>
      </div>
    );
  }
  if (!user) return null; // redirect already in-flight

  const navLink = (item: (typeof NAV_ITEMS)[number]) => {
    const active = pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
          active
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
        {item.label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-forest">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf">
          <Sprout className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="text-[15px] font-bold leading-tight text-white">HabitWealth</p>
          <p className="text-[11px] text-white/50">habits → wealth</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(navLink)}
        {user.role === "admin" &&
          navLink({ href: "/admin", label: "Admin Panel", icon: ShieldCheck })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-white/50">{user.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      <div className="min-h-screen lg:pl-64">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          {sidebar}
        </aside>

        {/* Mobile slide-over sidebar */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
          </div>
        )}

        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-lg p-2 text-ink-soft hover:bg-leaf-soft lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <p className="hidden text-sm text-ink-faint lg:block">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {/* Notification bell: habits not yet done this period */}
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              className="relative rounded-xl border border-line bg-card p-2.5 text-ink-soft transition-colors hover:border-leaf hover:text-leaf"
              aria-label="Habit reminders"
            >
              <Bell size={17} />
              {dueHabits.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white">
                  {dueHabits.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-line bg-card p-3 shadow-xl">
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Habit reminders
                </p>
                {dueHabits.length === 0 ? (
                  <p className="rounded-xl bg-leaf-soft px-3 py-3 text-sm text-leaf">
                    All habits done for now. Enjoy your day!
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {dueHabits.map((habit) => (
                      <li key={habit.id}>
                        <Link
                          href="/habits"
                          onClick={() => setBellOpen(false)}
                          className="flex items-center justify-between rounded-xl bg-gold-soft px-3 py-2.5 text-sm text-ink transition-colors hover:bg-gold/30"
                        >
                          <span className="font-medium">{habit.name}</span>
                          <span className="text-[11px] uppercase tracking-wide text-ink-soft">
                            {habit.frequency}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
