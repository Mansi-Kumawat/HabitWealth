/**
 * SEED SCRIPT - fills the database with believable demo data.
 * ============================================================
 * Run it with:  npx tsx scripts/seed.ts
 *
 * A seed script exists so every developer (and every reviewer) starts from
 * the SAME realistic dataset instead of an empty app. It is also idempotent:
 * if users already exist, it stops with a message instead of duplicating
 * everything (re-running seed scripts is the #1 way demo databases get
 * messy).
 *
 * Demo logins after seeding (see README):
 *   admin@habitwealth.app / Admin@123   (admin)
 *   priya@example.com     / Demo@123    (salaried professional)
 *   arjun@example.com     / Demo@123    (student)
 *   meera@example.com     / Demo@123    (freelancer)
 *   aarav@example.com     / Demo@123    (couple saving for a house)
 */
import { config } from "dotenv";
config(); // load .env so DATABASE_URL is available when run via tsx

import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  categories,
  feedback,
  goalContributions,
  habitLogs,
  habits,
  incomeSources,
  netWorthSnapshots,
  savingsGoals,
  transactions,
  users,
  wealthItems,
} from "../src/db/schema";
import { getISOWeekKey, toDateKey } from "../src/lib/dates";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/** Date helper: the date key N days before today. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}
/** Month key N months before this month, e.g. monthKeyAgo(1) -> "2026-01". */
function monthKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Deterministic pseudo-random number (same data on every machine).
 *  We avoid Math.random so reseeding after a reset always looks identical. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

async function main() {
  console.log("Checking whether the database is already seeded...");
  const existing = await db.select().from(users);
  if (existing.length > 0) {
    console.log(`Found ${existing.length} users already - nothing to do.`);
    console.log("To reseed, clear the tables first (see README section 6).");
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash("Demo@123", 10);
  const adminHash = await bcrypt.hash("Admin@123", 10);

  // ------------------------------------------------------------------
  // 1. USERS - one admin + four different life situations.
  // ------------------------------------------------------------------
  const [admin, priya, arjun, meera, aarav] = await db
    .insert(users)
    .values([
      { name: "Platform Admin", email: "admin@habitwealth.app", passwordHash: adminHash, role: "admin", occupation: "Administrator" },
      {
        name: "Priya Nair", email: "priya@example.com", passwordHash, occupation: "Software Engineer, Pune",
        phone: "+91 98220 44531", monthlyIncomeTarget: 42000, monthlySavingsTarget: 10000,
        financialGoalsText: "Build a 6-month emergency fund, then increase my SIP to ₹8,000/month.",
        createdAt: new Date(Date.now() - 155 * 86400000),
      },
      {
        name: "Arjun Verma", email: "arjun@example.com", passwordHash, occupation: "M.Tech student, Delhi",
        phone: "+91 98110 72240", monthlyIncomeTarget: 12000, monthlySavingsTarget: 2500,
        financialGoalsText: "Save for a laptop and stop borrowing from friends before month-end.",
        createdAt: new Date(Date.now() - 140 * 86400000),
      },
      {
        name: "Meera Iyer", email: "meera@example.com", passwordHash, occupation: "Freelance designer, Bengaluru",
        phone: "+91 90040 66178", monthlyIncomeTarget: 55000, monthlySavingsTarget: 15000,
        financialGoalsText: "Smooth out irregular freelance income and max out my PPF this year.",
        createdAt: new Date(Date.now() - 130 * 86400000),
      },
      {
        name: "Aarav & Nisha Kapoor", email: "aarav@example.com", passwordHash, occupation: "Teachers, Jaipur",
        phone: "+91 99280 31194", monthlyIncomeTarget: 85000, monthlySavingsTarget: 30000,
        financialGoalsText: "House down payment in 3 years. Every month counts.",
        createdAt: new Date(Date.now() - 120 * 86400000),
      },
    ])
    .returning();
  console.log("Users created.");

  // ------------------------------------------------------------------
  // 2. CATEGORIES - global defaults (userId null = everyone sees them).
  // ------------------------------------------------------------------
  const expenseCategories = ["Food", "Transport", "Rent", "Utilities", "Shopping", "Health", "Education", "Entertainment", "Subscriptions", "Other"];
  const incomeCategories = ["Salary", "Freelance", "Stipend", "Interest", "Other"];
  await db.insert(categories).values([
    ...expenseCategories.map((name) => ({ userId: null, name, type: "expense" as const })),
    ...incomeCategories.map((name) => ({ userId: null, name, type: "income" as const })),
  ]);
  console.log("Categories seeded.");

  // ------------------------------------------------------------------
  // 3. INCOME SOURCES per user.
  // ------------------------------------------------------------------
  await db.insert(incomeSources).values([
    { userId: priya.id, name: "Salary - TechNova Pvt Ltd", amount: 42000, frequency: "monthly" },
    { userId: priya.id, name: "Weekend UI gigs", amount: 6000, frequency: "monthly" },
    { userId: arjun.id, name: "Research stipend", amount: 12000, frequency: "monthly" },
    { userId: arjun.id, name: "Maths tutoring", amount: 3000, frequency: "monthly" },
    { userId: meera.id, name: "Client projects", amount: 48000, frequency: "monthly" },
    { userId: meera.id, name: "Template sales", amount: 7000, frequency: "monthly" },
    { userId: aarav.id, name: "Salary - Aarav (school)", amount: 46000, frequency: "monthly" },
    { userId: aarav.id, name: "Salary - Nisha (school)", amount: 39000, frequency: "monthly" },
  ]);

  // ------------------------------------------------------------------
  // 4. TRANSACTIONS - 4-5 months of believable history per user.
  //    Templates repeat monthly; a deterministic random wobbles amounts
  //    and decides which optional expenses happened that month.
  // ------------------------------------------------------------------
  type TxTemplate = {
    type: "income" | "expense"; category: string;
    min: number; max: number; dayOfMonth: number;
    note: string; method: string; chance?: number;
  };

  const priyaTx: TxTemplate[] = [
    { type: "income", category: "Salary", min: 42000, max: 42000, dayOfMonth: 1, note: "Salary credited - TechNova", method: "Bank" },
    { type: "income", category: "Freelance", min: 4000, max: 9000, dayOfMonth: 18, note: "Weekend UI gig payout", method: "UPI", chance: 0.7 },
    { type: "expense", category: "Rent", min: 12000, max: 12000, dayOfMonth: 5, note: "Monthly rent - Kothrud flat", method: "Net Banking" },
    { type: "expense", category: "Food", min: 260, max: 420, dayOfMonth: 3, note: "Zomato order", method: "UPI" },
    { type: "expense", category: "Food", min: 180, max: 350, dayOfMonth: 9, note: "Swiggy - office lunch", method: "UPI" },
    { type: "expense", category: "Food", min: 1800, max: 2600, dayOfMonth: 12, note: "Groceries at DMart", method: "Card" },
    { type: "expense", category: "Transport", min: 500, max: 500, dayOfMonth: 2, note: "Metro card recharge", method: "UPI" },
    { type: "expense", category: "Transport", min: 300, max: 620, dayOfMonth: 16, note: "Uber ride home", method: "UPI", chance: 0.8 },
    { type: "expense", category: "Utilities", min: 700, max: 1150, dayOfMonth: 8, note: "Electricity bill", method: "Net Banking" },
    { type: "expense", category: "Utilities", min: 499, max: 499, dayOfMonth: 10, note: "JioFiber broadband", method: "UPI" },
    { type: "expense", category: "Subscriptions", min: 199, max: 199, dayOfMonth: 14, note: "Netflix Standard", method: "Card" },
    { type: "expense", category: "Subscriptions", min: 119, max: 119, dayOfMonth: 21, note: "Spotify Premium", method: "UPI" },
    { type: "expense", category: "Shopping", min: 1200, max: 3400, dayOfMonth: 19, note: "Amazon - kurtis and shoes", method: "Card", chance: 0.6 },
    { type: "expense", category: "Health", min: 250, max: 800, dayOfMonth: 23, note: "Apollo pharmacy", method: "UPI", chance: 0.5 },
    { type: "expense", category: "Entertainment", min: 350, max: 700, dayOfMonth: 26, note: "PVR movie night", method: "Card", chance: 0.7 },
    { type: "expense", category: "Other", min: 3000, max: 3000, dayOfMonth: 27, note: "SIP - Nifty index fund", method: "Net Banking" },
  ];

  const arjunTx: TxTemplate[] = [
    { type: "income", category: "Stipend", min: 12000, max: 12000, dayOfMonth: 7, note: "Monthly research stipend", method: "Net Banking" },
    { type: "income", category: "Other", min: 1500, max: 3000, dayOfMonth: 22, note: "Maths tutoring - Class 10", method: "UPI", chance: 0.8 },
    { type: "expense", category: "Rent", min: 4500, max: 4500, dayOfMonth: 4, note: "PG accommodation", method: "UPI" },
    { type: "expense", category: "Food", min: 60, max: 140, dayOfMonth: 2, note: "College canteen", method: "Cash" },
    { type: "expense", category: "Food", min: 180, max: 320, dayOfMonth: 11, note: "Maggi + chai with hostel mates", method: "Cash" },
    { type: "expense", category: "Food", min: 900, max: 1400, dayOfMonth: 15, note: "Monthly mess fees top-up", method: "UPI" },
    { type: "expense", category: "Transport", min: 300, max: 300, dayOfMonth: 1, note: "Metro student pass", method: "UPI" },
    { type: "expense", category: "Education", min: 600, max: 1500, dayOfMonth: 9, note: "GATE prep books", method: "UPI", chance: 0.5 },
    { type: "expense", category: "Subscriptions", min: 59, max: 59, dayOfMonth: 17, note: "YouTube Premium student", method: "UPI" },
    { type: "expense", category: "Entertainment", min: 150, max: 400, dayOfMonth: 24, note: "Movie with friends", method: "Cash", chance: 0.6 },
    { type: "expense", category: "Other", min: 500, max: 500, dayOfMonth: 28, note: "FD deposit - SBI", method: "Net Banking" },
  ];

  const meeraTx: TxTemplate[] = [
    { type: "income", category: "Freelance", min: 18000, max: 26000, dayOfMonth: 6, note: "Logo project - Cafe Aroma", method: "Net Banking" },
    { type: "income", category: "Freelance", min: 15000, max: 24000, dayOfMonth: 20, note: "Website redesign - milestone 2", method: "Net Banking", chance: 0.75 },
    { type: "income", category: "Other", min: 6000, max: 9000, dayOfMonth: 25, note: "Template sales - Gumroad", method: "Net Banking", chance: 0.85 },
    { type: "expense", category: "Rent", min: 15500, max: 15500, dayOfMonth: 3, note: "1BHK rent - Indiranagar", method: "Net Banking" },
    { type: "expense", category: "Food", min: 2200, max: 3200, dayOfMonth: 8, note: "BigBasket groceries", method: "UPI" },
    { type: "expense", category: "Food", min: 300, max: 650, dayOfMonth: 14, note: "Third Wave coffee - client meet", method: "Card", chance: 0.8 },
    { type: "expense", category: "Utilities", min: 900, max: 1400, dayOfMonth: 11, note: "BESCOM electricity", method: "UPI" },
    { type: "expense", category: "Subscriptions", min: 1399, max: 1399, dayOfMonth: 16, note: "Adobe Creative Cloud", method: "Card" },
    { type: "expense", category: "Transport", min: 800, max: 1800, dayOfMonth: 13, note: "Fuel + Rapido rides", method: "UPI" },
    { type: "expense", category: "Health", min: 1500, max: 1500, dayOfMonth: 19, note: "Yoga studio monthly", method: "UPI" },
    { type: "expense", category: "Shopping", min: 2000, max: 4500, dayOfMonth: 27, note: "Wacom pen + sketchbooks", method: "Card", chance: 0.55 },
    { type: "expense", category: "Other", min: 5000, max: 5000, dayOfMonth: 29, note: "PPF deposit", method: "Net Banking" },
  ];

  const aaravTx: TxTemplate[] = [
    { type: "income", category: "Salary", min: 46000, max: 46000, dayOfMonth: 1, note: "Salary - Aarav", method: "Net Banking" },
    { type: "income", category: "Salary", min: 39000, max: 39000, dayOfMonth: 1, note: "Salary - Nisha", method: "Net Banking" },
    { type: "expense", category: "Rent", min: 18000, max: 18000, dayOfMonth: 2, note: "Flat rent - Malviya Nagar", method: "Net Banking" },
    { type: "expense", category: "Food", min: 6000, max: 8500, dayOfMonth: 10, note: "Monthly groceries - Reliance Smart", method: "Card" },
    { type: "expense", category: "Utilities", min: 1600, max: 2400, dayOfMonth: 7, note: "Electricity + water", method: "UPI" },
    { type: "expense", category: "Transport", min: 2500, max: 3400, dayOfMonth: 12, note: "Car fuel - both commutes", method: "Card" },
    { type: "expense", category: "Education", min: 2200, max: 2200, dayOfMonth: 15, note: "Online course - Nisha (CTET prep)", method: "Card" },
    { type: "expense", category: "Entertainment", min: 800, max: 1800, dayOfMonth: 21, note: "Family dinner - Barbeque Nation", method: "Card", chance: 0.7 },
    { type: "expense", category: "Subscriptions", min: 649, max: 649, dayOfMonth: 23, note: "Prime Video + mobile plans", method: "UPI" },
    { type: "expense", category: "Health", min: 400, max: 1200, dayOfMonth: 17, note: "Medicines - parents", method: "UPI", chance: 0.6 },
    { type: "expense", category: "Other", min: 25000, max: 25000, dayOfMonth: 5, note: "House fund transfer + SIP", method: "Net Banking" },
  ];

  async function seedTransactionsFor(userId: number, template: TxTemplate[], seed: number) {
    const rand = makeRandom(seed);
    const rows: (typeof transactions.$inferInsert)[] = [];
    // Walk back through the last 5 months month by month.
    for (let monthsBack = 4; monthsBack >= 0; monthsBack--) {
      const now = new Date();
      const cursor = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const todayDay = monthsBack === 0 ? now.getDate() : daysInMonth;

      for (const t of template) {
        if (t.dayOfMonth > todayDay) continue; // future day of current month
        if (t.chance && rand() > t.chance) continue; // optional expense skipped
        const wobble = t.min + Math.round(rand() * (t.max - t.min));
        const date = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), t.dayOfMonth, 12));
        rows.push({
          userId, type: t.type, category: t.category,
          amount: wobble, date, note: t.note,
          paymentMethod: t.method,
          createdAt: new Date(cursor.getFullYear(), cursor.getMonth(), t.dayOfMonth, 10),
        });
      }
    }
    await db.insert(transactions).values(rows);
    return rows;
  }

  const priyaRows = await seedTransactionsFor(priya.id, priyaTx, 42);
  const arjunRows = await seedTransactionsFor(arjun.id, arjunTx, 7);
  const meeraRows = await seedTransactionsFor(meera.id, meeraTx, 99);
  const aaravRows = await seedTransactionsFor(aarav.id, aaravTx, 1234);
  console.log("Transactions seeded.");

  // ------------------------------------------------------------------
  // 5. HABITS + LOGS with real streaks.
  // ------------------------------------------------------------------
  async function seedHabit(
    userId: number,
    def: { name: string; type: "saving" | "budgeting" | "investing" | "custom"; frequency: "daily" | "weekly" | "monthly"; targetAmount?: number; reminderTime?: string },
    doneDateKeys: string[] // explicit list of completed days (for believable streaks)
  ) {
    const [habit] = await db.insert(habits).values({
      userId,
      name: def.name,
      type: def.type,
      frequency: def.frequency,
      targetAmount: def.targetAmount ?? null,
      reminderTime: def.reminderTime ?? "21:00",
      createdAt: new Date(Date.now() - 100 * 86400000),
    }).returning();
    if (doneDateKeys.length > 0) {
      await db.insert(habitLogs).values(
        // Deduplicate period keys: two logs can share a date but never a period.
        [...new Set(
          doneDateKeys.map((dateKey) => {
            const d = new Date(`${dateKey}T12:00:00`);
            const periodKey =
              def.frequency === "daily" ? dateKey
              : def.frequency === "weekly" ? getISOWeekKey(d)
              : dateKey.slice(0, 7);
            return periodKey;
          })
        )].map((periodKey, i) => ({
          habitId: habit.id,
          userId,
          periodKey,
          loggedDate: doneDateKeys[i] ?? doneDateKeys[0],
          createdAt: new Date(`${doneDateKeys[0]}T20:00:00`),
        }))
      );
    }
    return habit;
  }

  const streakOf = (n: number) => Array.from({ length: n }, (_, i) => daysAgo(i));

  // Priya: strong logger (12-day streak incl. today), saver on a 6-day streak.
  await seedHabit(priya.id, { name: "Log all expenses daily", type: "budgeting", frequency: "daily" }, streakOf(12));
  await seedHabit(priya.id, { name: "Save ₹100 daily", type: "saving", frequency: "daily", targetAmount: 100 }, streakOf(6));
  await seedHabit(priya.id, { name: "Invest monthly", type: "investing", frequency: "monthly", targetAmount: 3000 }, [daysAgo(3), daysAgo(32), daysAgo(63), daysAgo(94)]);
  await seedHabit(priya.id, { name: "Review budget weekly", type: "budgeting", frequency: "weekly" }, [daysAgo(2), daysAgo(9), daysAgo(23)]);

  // Arjun: a broken chain (missed yesterday) + weekly no-spend day.
  await seedHabit(arjun.id, { name: "Log all expenses daily", type: "budgeting", frequency: "daily" }, [daysAgo(0), daysAgo(2), daysAgo(3), daysAgo(4)]);
  await seedHabit(arjun.id, { name: "No-spend day weekly", type: "budgeting", frequency: "weekly" }, [daysAgo(3), daysAgo(10), daysAgo(17), daysAgo(24)]);
  await seedHabit(arjun.id, { name: "Save ₹50 daily", type: "saving", frequency: "daily", targetAmount: 50 }, streakOf(4));

  // Meera: monthly investing + weekly review, both consistent.
  await seedHabit(meera.id, { name: "Invest monthly", type: "investing", frequency: "monthly", targetAmount: 5000 }, [daysAgo(4), daysAgo(35), daysAgo(66), daysAgo(97)]);
  await seedHabit(meera.id, { name: "Review budget weekly", type: "budgeting", frequency: "weekly" }, [daysAgo(1), daysAgo(8), daysAgo(15), daysAgo(22), daysAgo(29)]);
  await seedHabit(meera.id, { name: "Log all expenses daily", type: "budgeting", frequency: "daily" }, streakOf(9));

  // Kapoor family: big savers.
  await seedHabit(aarav.id, { name: "Log all expenses daily", type: "budgeting", frequency: "daily" }, streakOf(21));
  await seedHabit(aarav.id, { name: "No-spend day weekly", type: "budgeting", frequency: "weekly" }, [daysAgo(2), daysAgo(9), daysAgo(16), daysAgo(30)]);
  await seedHabit(aarav.id, { name: "Invest monthly", type: "investing", frequency: "monthly", targetAmount: 25000 }, [daysAgo(5), daysAgo(36), daysAgo(67), daysAgo(98)]);
  console.log("Habits and logs seeded.");

  // ------------------------------------------------------------------
  // 6. SAVINGS GOALS + contribution history.
  // ------------------------------------------------------------------
  async function seedGoal(
    userId: number,
    def: { title: string; target: number; saved: number; deadlineInDays?: number; priority?: "low" | "medium" | "high"; completed?: boolean },
    contributions: { amount: number; daysAgoN: number }[]
  ) {
    const deadline = def.deadlineInDays
      ? toDateKey(new Date(Date.now() + def.deadlineInDays * 86400000))
      : null;
    const [goal] = await db.insert(savingsGoals).values({
      userId,
      title: def.title,
      targetAmount: def.target,
      currentAmount: def.saved,
      deadline,
      priority: def.priority ?? "medium",
      status: def.completed ? "completed" : "active",
      createdAt: new Date(Date.now() - Math.max(30, (contributions.at(-1)?.daysAgoN ?? 40) + 5) * 86400000),
    }).returning();
    if (contributions.length > 0) {
      await db.insert(goalContributions).values(
        contributions.map((c) => ({
          goalId: goal.id, userId, amount: c.amount,
          note: c.amount >= 0 ? "Deposit" : "Withdrawal",
          createdAt: new Date(Date.now() - c.daysAgoN * 86400000),
        }))
      );
    }
  }

  await seedGoal(priya.id, { title: "Emergency Fund", target: 150000, saved: 58500, deadlineInDays: 320, priority: "high" }, [
    { amount: 12000, daysAgoN: 95 }, { amount: 12000, daysAgoN: 64 }, { amount: 12500, daysAgoN: 33 }, { amount: 14000, daysAgoN: 2 },
  ]);
  await seedGoal(priya.id, { title: "Goa Trip with friends", target: 40000, saved: 22000, deadlineInDays: 120, priority: "low" }, [
    { amount: 8000, daysAgoN: 60 }, { amount: 7000, daysAgoN: 30 }, { amount: 7000, daysAgoN: 1 },
  ]);
  await seedGoal(arjun.id, { title: "New Laptop", target: 65000, saved: 41250, deadlineInDays: 150, priority: "high" }, [
    { amount: 10000, daysAgoN: 90 }, { amount: 11250, daysAgoN: 60 }, { amount: 10000, daysAgoN: 31 }, { amount: 10000, daysAgoN: 3 },
  ]);
  await seedGoal(meera.id, { title: "Emergency Fund", target: 200000, saved: 84000, deadlineInDays: 400, priority: "high" }, [
    { amount: 20000, daysAgoN: 85 }, { amount: 22000, daysAgoN: 55 }, { amount: 21000, daysAgoN: 25 }, { amount: 21000, daysAgoN: 4 },
  ]);
  await seedGoal(meera.id, { title: "Mirrorless Camera", target: 90000, saved: 90000, completed: true }, [
    { amount: 30000, daysAgoN: 100 }, { amount: 30000, daysAgoN: 70 }, { amount: 30000, daysAgoN: 40 },
  ]);
  await seedGoal(aarav.id, { title: "House Down Payment", target: 1500000, saved: 375000, deadlineInDays: 1000, priority: "high" }, [
    { amount: 95000, daysAgoN: 92 }, { amount: 95000, daysAgoN: 62 }, { amount: 95000, daysAgoN: 32 }, { amount: 90000, daysAgoN: 5 },
  ]);
  await seedGoal(aarav.id, { title: "Kerala Vacation", target: 120000, saved: 46000, deadlineInDays: 200, priority: "medium" }, [
    { amount: 16000, daysAgoN: 65 }, { amount: 15000, daysAgoN: 35 }, { amount: 15000, daysAgoN: 6 },
  ]);
  console.log("Goals and contributions seeded.");

  // ------------------------------------------------------------------
  // 7. WEALTH ITEMS - investments (with gains AND losses), assets, one loan.
  // ------------------------------------------------------------------
  await db.insert(wealthItems).values([
    { userId: priya.id, kind: "investment", name: "Nifty 50 Index Fund (UTI)", subType: "Mutual Fund", investedAmount: 36000, currentValue: 41250 },
    { userId: priya.id, kind: "investment", name: "SBI Fixed Deposit", subType: "FD", investedAmount: 50000, currentValue: 51800 },
    { userId: priya.id, kind: "investment", name: "Sovereign Gold Bond", subType: "Gold", investedAmount: 25000, currentValue: 26900 },
    { userId: priya.id, kind: "asset", name: "Two-wheeler (Activa)", subType: "Vehicle", investedAmount: 0, currentValue: 55000 },

    { userId: arjun.id, kind: "investment", name: "SBI Fixed Deposit", subType: "FD", investedAmount: 8000, currentValue: 8340 },

    { userId: meera.id, kind: "investment", name: "PPF Account - SBI", subType: "PPF", investedAmount: 60000, currentValue: 63400 },
    { userId: meera.id, kind: "investment", name: "Stocks - smallcase IT", subType: "Stocks", investedAmount: 48000, currentValue: 44100 },
    { userId: meera.id, kind: "investment", name: "Digital Gold", subType: "Gold", investedAmount: 12000, currentValue: 13050 },
    { userId: meera.id, kind: "asset", name: "Gold chain (22k)", subType: "Gold", investedAmount: 0, currentValue: 38000 },

    { userId: aarav.id, kind: "investment", name: "Nifty 50 Index Fund (HDFC)", subType: "Mutual Fund", investedAmount: 110000, currentValue: 128500 },
    { userId: aarav.id, kind: "investment", name: "Joint Fixed Deposit", subType: "FD", investedAmount: 150000, currentValue: 158200 },
    { userId: aarav.id, kind: "investment", name: "Sovereign Gold Bonds", subType: "Gold", investedAmount: 90000, currentValue: 97200 },
    { userId: aarav.id, kind: "asset", name: "Car (i20, 2021)", subType: "Vehicle", investedAmount: 0, currentValue: 520000 },
    { userId: aarav.id, kind: "liability", name: "Car loan - outstanding", subType: "Loan", investedAmount: 0, currentValue: 140000 },
  ]);
  console.log("Wealth items seeded.");

  // ------------------------------------------------------------------
  // 8. NET WORTH SNAPSHOTS - 4 past months + believable month-on-month
  //    growth computed from the REAL seeded transactions.
  // ------------------------------------------------------------------
  function savingsUpToMonthEnd(rows: { type: string; amount: number; date: string }[], monthKey: string): number {
    return rows
      .filter((r) => r.date.slice(0, 7) <= monthKey)
      .reduce((sum, r) => sum + (r.type === "income" ? r.amount : -r.amount), 0);
  }

  async function seedSnapshots(userId: number, userRows: { type: string; amount: number; date: string }[], invests: number[], assets: number, liability: number, monthlyLiabilityPayment = 0) {
    // invests[4] = current value; invests[m] = value m months ago (smaller).
    for (let m = 4; m >= 0; m--) {
      const monthKey = monthKeyAgo(m);
      const savings = Math.round(savingsUpToMonthEnd(userRows, monthKey) * 100) / 100;
      const investments = invests[m] ?? invests[invests.length - 1];
      const liabilities = liability > 0 ? liability + m * monthlyLiabilityPayment : 0;
      const netWorth = Math.round((savings + investments + assets - liabilities) * 100) / 100;
      await db.insert(netWorthSnapshots).values({
        userId, monthKey,
        savings: Math.round(savings * 100) / 100,
        investments, assets, liabilities, netWorth,
        createdAt: new Date(`${monthKey}-28T10:00:00`),
      });
    }
  }

  await seedSnapshots(priya.id, priyaRows, [76000, 83500, 90500, 98000, 117950], 55000, 0);
  await seedSnapshots(arjun.id, arjunRows, [4000, 5200, 6300, 7300, 8340], 0, 0);
  await seedSnapshots(meera.id, meeraRows, [88000, 98500, 107200, 114600, 120550], 38000, 0);
  await seedSnapshots(aarav.id, aaravRows, [296000, 338000, 356500, 369800, 383900], 520000, 140000, 5500);
  console.log("Net worth snapshots seeded.");

  // ------------------------------------------------------------------
  // 9. FEEDBACK TICKETS in different statuses.
  // ------------------------------------------------------------------
  await db.insert(feedback).values([
    {
      userId: priya.id, subject: "CSV report includes previous month's row",
      message: "I downloaded the report for this month and the first row is dated last month. Not a blocker but confusing.",
      status: "in_progress",
      adminNote: "Thanks Priya - we reproduced it and a fix is in testing.",
      createdAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      userId: arjun.id, subject: "Suggestion: dark mode",
      message: "I mostly track expenses late at night. A dark theme would be easier on the eyes.",
      status: "open",
      createdAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      userId: meera.id, subject: "Streak count question (resolved)",
      message: "My weekly habit showed a lower streak than I expected - is the week counted Monday to Sunday?",
      status: "resolved",
      adminNote: "Yes - weeks run Monday to Sunday (ISO weeks). A missed week resets the chain. Closing this, feel free to reopen!",
      createdAt: new Date(Date.now() - 12 * 86400000),
    },
    {
      userId: aarav.id, subject: "Feature request: shared goals",
      message: "My wife and I both log into the same account. Separate logins with a shared House Down Payment goal would be perfect.",
      status: "open",
      createdAt: new Date(Date.now() - 6 * 3600000),
    },
  ]);
  console.log("Feedback tickets seeded.");

  console.log("\nSeed complete! Demo logins:");
  console.log("  admin@habitwealth.app / Admin@123   (admin)");
  console.log("  priya@example.com / Demo@123        (salaried professional)");
  console.log("  arjun@example.com / Demo@123        (student)");
  console.log("  meera@example.com / Demo@123        (freelancer)");
  console.log("  aarav@example.com / Demo@123        (couple)");
  await pool.end();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await pool.end();
  process.exit(1);
});
