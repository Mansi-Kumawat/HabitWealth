import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "HabitWealth - Financial Habit Builder & Wealth Tracker",
  description:
    "Build consistent money habits - saving daily, tracking expenses, investing monthly - and watch your wealth grow over time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
