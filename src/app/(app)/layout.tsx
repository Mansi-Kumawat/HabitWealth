import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

/**
 * ROUTE GROUP LAYOUT
 * ==================
 * The folder is named "(app)" - parentheses mean "route group": the folder
 * name does NOT appear in the URL, but its layout WRAPS every page inside.
 * So /dashboard, /transactions, /habits, /goals, /wealth, /profile, /admin
 * all share the AppShell (sidebar, topbar, auth context, notification bell),
 * while /login and /register in the "(auth)" group stay clean and sidebar-free.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
