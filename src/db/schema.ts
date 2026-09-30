/**
 * DATABASE SCHEMA (the "models" of the app)
 * =========================================
 * In a MERN app you would write Mongoose schemas here. We use Drizzle ORM,
 * which does the same job for PostgreSQL: each `pgTable(...)` below describes
 * one table (MongoDB calls tables "collections") and its columns ("fields").
 *
 * RELATIONSHIPS
 * -------------
 * MongoDB uses `ref` to link documents. SQL uses FOREIGN KEYS: a column that
 * stores the id of a row in another table. You will see lines like:
 *    userId: integer("user_id").references(() => users.id)
 * That means "this row BELONGS TO one user". If you know the user id, you can
 * find all of that user's transactions, habits, goals, etc.
 *
 * INDEXES
 * -------
 * An index is like the index at the back of a textbook: it lets the database
 * find rows fast without reading every single row. We add indexes on
 * (userId, date) because the dashboard constantly asks "give me THIS user's
 * rows for THIS month" - the index makes that query fast even with 1M rows.
 *
 * MONEY
 * -----
 * Money is stored as a number rounded to 2 decimals (see round2 in
 * src/lib/finance.ts). Storing "paise" as integers (e.g. Rs 10.50 -> 1050)
 * is the strictly safer approach used by banks because computers represent
 * decimals in binary and 0.1 + 0.2 === 0.30000000000000004 in JavaScript!
 * For a learning project, rounded decimals are simpler to read, so we use
 * them and ALWAYS round through round2() before saving.
 */

import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// USERS - one row per registered account (regular users AND admins).
// The "financial profile" (occupation, income target etc.) is embedded right
// on the user row, just like an embedded sub-document in MongoDB.
// The password is NEVER stored in plain text - only a bcrypt hash.
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "admin"] })
      .notNull()
      .default("user"),
    // Admins can deactivate an account without deleting its data.
    isActive: boolean("is_active").notNull().default(true),

    // ----- Financial profile fields -----
    phone: text("phone").default(""),
    occupation: text("occupation").default(""),
    monthlyIncomeTarget: doublePrecision("monthly_income_target").default(0),
    monthlySavingsTarget: doublePrecision("monthly_savings_target").default(0),
    financialGoalsText: text("financial_goals_text").default(""),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

// ---------------------------------------------------------------------------
// INCOME SOURCES - a user can have many sources (Salary, Freelance, Stipend).
// One user -> many income sources (a "one-to-many" relationship).
// ---------------------------------------------------------------------------
export const incomeSources = pgTable("income_sources", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(), // e.g. "Salary"
  amount: doublePrecision("amount").notNull(), // expected amount
  frequency: text("frequency", {
    enum: ["one-time", "weekly", "monthly", "yearly"],
  })
    .notNull()
    .default("monthly"),
});

// ---------------------------------------------------------------------------
// CATEGORIES - expense/income labels like Food, Rent, Salary.
// Rows with userId = NULL are GLOBAL default categories seeded for everyone.
// Rows with a userId are custom categories created by that one user.
// ---------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // null = global
  name: text("name").notNull(),
  type: text("type", { enum: ["income", "expense"] })
    .notNull()
    .default("expense"),
});

// ---------------------------------------------------------------------------
// TRANSACTIONS - the heart of the tracker. Every income or expense record.
// `date` is stored as a plain calendar date (YYYY-MM-DD) with NO time part.
// That is a deliberate choice: "which day did you spend this?" never depends
// on the exact hour, and storing only the date avoids almost all timezone
// bugs (a very common beginner problem!).
// ---------------------------------------------------------------------------
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    category: text("category").notNull(), // e.g. "Food"
    amount: doublePrecision("amount").notNull(), // always positive
    date: date("date", { mode: "string" }).notNull(), // "YYYY-MM-DD"
    note: text("note").default(""),
    paymentMethod: text("payment_method").default("UPI"), // Cash/UPI/Card/...
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Speeds up "all transactions for user X between dates A and B".
    index("transactions_user_date_idx").on(table.userId, table.date),
  ]
);

// ---------------------------------------------------------------------------
// HABITS - a financial habit the user wants to build (e.g. "Save Rs 100 daily").
// `frequency` decides what "one period" means for streaks:
//   daily   -> per calendar day
//   weekly  -> per ISO week (Mon-Sun)
//   monthly -> per calendar month
// ---------------------------------------------------------------------------
export const habits = pgTable(
  "habits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["saving", "budgeting", "investing", "custom"],
    })
      .notNull()
      .default("custom"),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly"] })
      .notNull()
      .default("daily"),
    targetAmount: doublePrecision("target_amount"), // optional
    reminderTime: text("reminder_time").default("21:00"), // "HH:MM" local time
    isActive: boolean("is_active").notNull().default(true), // false = paused
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("habits_user_idx").on(table.userId)]
);

// ---------------------------------------------------------------------------
// HABIT LOGS - ONE row per completed period. If a habit is marked done today,
// we insert a log with today's periodKey. The unique index on
// (habitId, periodKey) makes "one completion per period" IMPOSSIBLE to break,
// even if the user double-clicks the button (the 2nd insert is rejected).
// Streaks are computed by reading these logs (see computeStreaks).
// ---------------------------------------------------------------------------
export const habitLogs = pgTable(
  "habit_logs",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    periodKey: text("period_key").notNull(), // "2026-02-11" | "2026-W07" | "2026-02"
    loggedDate: date("logged_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("habit_logs_habit_period_unique").on(
      table.habitId,
      table.periodKey
    ),
    index("habit_logs_user_idx").on(table.userId),
  ]
);

// ---------------------------------------------------------------------------
// SAVINGS GOALS - e.g. "Emergency Fund - Rs 50,000 by December".
// currentAmount is kept on the goal for quick reads, and every change is also
// recorded as a row in goal_contributions (the "history").
// ---------------------------------------------------------------------------
export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    targetAmount: doublePrecision("target_amount").notNull(),
    currentAmount: doublePrecision("current_amount").notNull().default(0),
    deadline: date("deadline", { mode: "string" }), // optional
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    status: text("status", { enum: ["active", "completed"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("goals_user_idx").on(table.userId)]
);

// ---------------------------------------------------------------------------
// GOAL CONTRIBUTIONS - deposit (positive amount) or withdrawal (negative).
// Keeping the history lets us show "you added Rs 2,000 on 5 Jan" and lets us
// estimate the completion date from your saving pace.
// ---------------------------------------------------------------------------
export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: serial("id").primaryKey(),
    goalId: integer("goal_id")
      .notNull()
      .references(() => savingsGoals.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amount: doublePrecision("amount").notNull(), // + deposit / - withdrawal
    note: text("note").default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("contributions_goal_idx").on(table.goalId)]
);

// ---------------------------------------------------------------------------
// WEALTH ITEMS - one table for investments, assets and liabilities.
//   investment: has investedAmount (what you paid) + currentValue (worth now)
//   asset:      things you own (gold, bike, bank balance) - currentValue only
//   liability:  money you owe (loans) - currentValue = outstanding amount
// One table with a `kind` column is simpler than three tables and this
// pattern is called "single table inheritance".
// ---------------------------------------------------------------------------
export const wealthItems = pgTable(
  "wealth_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: ["investment", "asset", "liability"] }).notNull(),
    name: text("name").notNull(), // e.g. "Nifty 50 Index Fund"
    subType: text("sub_type").default("Other"), // Mutual Fund/Stocks/FD/Gold/PPF/Loan
    investedAmount: doublePrecision("invested_amount").notNull().default(0),
    currentValue: doublePrecision("current_value").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("wealth_user_idx").on(table.userId)]
);

// ---------------------------------------------------------------------------
// NET WORTH SNAPSHOTS - a saved photo of your wealth at one point in time.
// We save ONE snapshot per user per month (monthKey like "2026-02"), upserted
// whenever money data changes. The growth line chart reads this table.
// ---------------------------------------------------------------------------
export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    monthKey: text("month_key").notNull(), // "YYYY-MM"
    savings: doublePrecision("savings").notNull().default(0),
    investments: doublePrecision("investments").notNull().default(0),
    assets: doublePrecision("assets").notNull().default(0),
    liabilities: doublePrecision("liabilities").notNull().default(0),
    netWorth: doublePrecision("net_worth").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("snapshots_user_month_unique").on(table.userId, table.monthKey),
  ]
);

// ---------------------------------------------------------------------------
// FEEDBACK - support tickets: users report issues/complaints, admins reply
// with an adminNote and move the status open -> in_progress -> resolved.
// ---------------------------------------------------------------------------
export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "in_progress", "resolved"] })
      .notNull()
      .default("open"),
    adminNote: text("admin_note").default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("feedback_user_idx").on(table.userId)]
);

// TypeScript types inferred from the tables above. `User` is the type of one
// row returned by a SELECT. This gives us autocomplete + compile-time safety.
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type WealthItem = typeof wealthItems.$inferSelect;
