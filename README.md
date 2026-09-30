# HabitWealth — Financial Habit Builder & Wealth Growth Tracker

> A beginner-friendly full-stack project: build consistent **financial habits** (saving daily, logging expenses, investing monthly) and watch your **wealth grow** over time — dashboards, streaks, goals, charts and an admin panel included.

---

## 1. Project overview & features

Most money apps only do budgeting. This one treats money as a **habit-formation problem**: small actions (log an expense, save ₹100, review the budget weekly) repeated until they stick, while a second layer tracks the outcome — your **net worth over time**.

**Feature list**

| Area | What you get |
|---|---|
| Auth & roles | Register/login with validation, bcrypt hashing, JWT sessions, user + admin roles, protected routes |
| Dashboard | One combined endpoint: summary cards, income-vs-expense bars, category donut, net-worth spark line, today's habits, goal widget, rule-based motivational insights |
| Expense & income tracker | Add/edit/delete, filters (type/category/date-range), pagination, monthly report (totals, savings rate, top-3 categories, vs last month), CSV download |
| Habit tracker | Custom habits + one-click presets, mark-done per period, current/longest streaks (daily/weekly/monthly), 30-day heatmap, pause/resume, due-today banner + notification bell |
| Savings goals | Targets, deadlines, priorities, deposits/withdrawals with history, % progress, on-track/behind indicator, estimated completion date, auto-complete |
| Wealth analytics | Investments (gain/loss), assets, liabilities, net worth formula, monthly snapshots (auto + manual button), line/donut/gain-loss charts |
| Profile & support | Financial profile (targets, occupation, goals text), income sources, feedback/complaint tickets with admin replies |
| Admin panel | User search + activate/deactivate (privacy-safe summary counts only), platform KPIs (DAU/WAU/MAU, habit completion rate, engagement…), activity chart + CSV, feedback queue with status workflows |

---

## 2. Tech stack — and *why* each tool

> **Honest note for learners:** this project was built with the *MERN pattern* (React frontend ↔ REST API ↔ database ↔ JWT auth) on a **Next.js + PostgreSQL** foundation. Every MERN concept has a 1-to-1 equivalent here, and this README explains both names so the knowledge transfers to any Express/MongoDB tutorial you follow next.

| MERN name | Used here | Why |
|---|---|---|
| React | **React 19** (inside Next.js) | Describe UI as components; re-renders when state changes |
| Express routes | **Next.js Route Handlers** (`src/app/api/**/route.ts`) | Same REST idea: one file per endpoint exporting `GET`/`POST`… |
| MongoDB + Mongoose | **PostgreSQL + Drizzle ORM** (`src/db/schema.ts`) | Tables instead of collections; schemas with types and relationships |
| JWT + bcrypt | **jose (JWT) + bcryptjs** | Stateless sessions + one-way password hashing |
| Axios | **axios** (central client in `src/lib/client.ts`) | Clean HTTP calls with automatic error unwrapping |
| Recharts | **Recharts** | Turns arrays of data into SVG charts |
| Tailwind CSS | **Tailwind v4** | Utility classes; design tokens in `globals.css` |
| Vite dev server | **Next.js dev/build pipeline** | Same instant development experience |
| Middleware | `src/middleware.ts` + per-route guards | Next.js middleware = Express middleware's cousin |
| Aggregation pipeline | **SQL GROUP BY / SUM** in Drizzle | Same idea: database does the math |

Other moving parts: **Vitest** (unit tests), **tsx** (run the seed script), **httpOnly cookies** (where the JWT lives).

---

## 3. How the whole app works

```
┌────────────────────────┐        HTTPS (JSON)         ┌────────────────────────┐
│  REACT PAGES (browser) │  ────────────────────────▶  │  NEXT.JS API ROUTES    │
│  /login /dashboard ... │   axios, session cookie     │  /api/auth /api/habits │
│  components + Recharts │  ◀────────────────────────  │  validate → authorize  │
└────────────────────────┘   { success, message, data }│  → query → respond     │
                                                        └──────────┬─────────────┘
                                                                   │ Drizzle ORM (SQL)
                                                        ┌──────────▼─────────────┐
                                                        │      POSTGRESQL        │
                                                        │ users, transactions,   │
                                                        │ habits, goals, ...     │
                                                        └────────────────────────┘
```

**Worked example — adding an expense and seeing the dashboard update:**

1. You type `349 / Food / Zomato order` in the form and click **Add transaction**.
2. `transactions/page.tsx` calls `api.post("/transactions", payload)` → axios sends `POST /api/transactions` **with your session cookie**.
3. The route (`src/app/api/transactions/route.ts`) runs `requireUser()` → verifies the JWT → knows you are user #2.
4. It validates (amount positive? date format ok?), then `db.insert(transactions)` with `userId: 2`.
5. It recalculates this month's **net worth snapshot** in the background.
6. It returns `{ success: true, message: "Expense logged.", data: {...} }`.
7. The page refetches its list — and the next time you open the dashboard, the combined `/api/dashboard` endpoint's aggregated sums already include your ₹349.

---

## 4. Prerequisites (install these first)

| Tool | Download | Verify with | Expected output |
|---|---|---|---|
| Node.js 20+ | https://nodejs.org | `node -v` | `v20.x` or higher |
| Git | https://git-scm.com | `git --version` | `git version 2.x` |
| VS Code | https://code.visualstudio.com | open it | — |
| REST client | Postman (postman.com) **or** the *Thunder Client* VS Code extension | — | — |

Everything else (`npm` comes with Node; the database is provided to this project) installs automatically in section 6.

---

## 5. Project folder structure — what each folder is for

```
financial-habit-tracker/
├── src/
│   ├── app/                          # PAGES + API (the whole app surface)
│   │   ├── (auth)/                   #   route group: public pages, no sidebar
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                    #   route group: protected pages WITH sidebar
│   │   │   ├── layout.tsx            #     wraps everything in <AppShell>
│   │   │   ├── dashboard/page.tsx    #     page 2: financial dashboard
│   │   │   ├── transactions/page.tsx #     page 3: expense & income tracker
│   │   │   ├── habits/page.tsx       #     page 4: habit tracker
│   │   │   ├── goals/page.tsx        #     page 5: savings goals
│   │   │   ├── wealth/page.tsx       #     page 6: wealth analytics
│   │   │   ├── profile/page.tsx      #     page 7: profile + feedback
│   │   │   └── admin/page.tsx        #     page 8: admin panel (admin only)
│   │   ├── api/                      #   REST API ("the Express app")
│   │   │   ├── auth/                 #     register / login / logout / me
│   │   │   ├── users/profile/        #     financial profile
│   │   │   ├── income-sources/       #     + [id]/ for update & delete
│   │   │   ├── categories/
│   │   │   ├── transactions/         #     + [id]/ + summary/ + report/ (CSV)
│   │   │   ├── habits/               #     + [id]/ + complete/
│   │   │   ├── goals/                #     + [id]/ + [id]/contributions/
│   │   │   ├── wealth/               #     + [id]/ + snapshot/
│   │   │   ├── dashboard/            #     ONE combined endpoint
│   │   │   ├── feedback/
│   │   │   ├── admin/                #     users / users[id] / analytics / feedback
│   │   │   └── health/               #     uptime check used by hosting
│   │   ├── layout.tsx                #   root layout (fonts/background)
│   │   ├── page.tsx                  #   "/" → redirects to /dashboard
│   │   ├── not-found.tsx             #   404 page
│   │   └── globals.css               #   Tailwind + design tokens
│   ├── components/
│   │   ├── AppShell.tsx              #   sidebar, topbar, bell, Auth Context
│   │   └── ui.tsx                    #   Button, Card, Modal, EmptyState… (UI kit)
│   ├── db/
│   │   ├── index.ts                  #   the database connection pool
│   │   └── schema.ts                 #   ALL models ("Mongoose schemas")
│   ├── lib/                          #   shared, well-commented utilities
│   │   ├── auth.ts                   #     bcrypt + JWT + session cookie
│   │   ├── api.ts                    #     response helpers, guards, rate limit
│   │   ├── client.ts                 #     axios instance for the browser
│   │   ├── currency.ts               #     ONE place for ₹/locale (change here)
│   │   ├── dates.ts                  #     period keys (daily/weekly/monthly)
│   │   ├── finance.ts                #     streaks, net worth, percentages ★
│   │   ├── insights.ts               #     rule-based motivational messages
│   │   └── wealth.ts                 #     net worth totals + snapshot service
│   └── middleware.ts                 #   route protection at the edge
├── scripts/seed.ts                   #   realistic demo data (npx tsx scripts/seed.ts)
├── tests/finance.test.ts             #   unit tests (streaks, net worth, %)
├── .env                              #   your secrets (NEVER commit)
├── .env.example                      #   template showing every variable
├── drizzle.config.json               #   tells drizzle-kit where the schema is
├── next.config.ts                    #   security headers live here
└── README.md                         #   you are here
```

---

## 6. Step-by-step local setup

### 6.1 Get the code
```bash
git clone <your-repo-url> financial-habit-tracker
cd financial-habit-tracker
```

### 6.2 The database
This workspace already provides a local PostgreSQL at `postgresql://postgres:postgres@127.0.0.1:5432/app_db` (it's what's in `.env`).

> **Learning note — "Atlas" equivalent:** in a classic MERN tutorial you'd create a **MongoDB Atlas** cluster (Sign up → Build a Database → free M0 → *Database Access* → add user → *Network Access* → allow IP `0.0.0.0/0` for dev → *Connect* → Drivers → copy the `mongodb+srv://...` string). For PostgreSQL the exact same journey exists at **Neon** (neon.tech) or **Supabase** (supabase.com): create project → copy the `postgresql://...` connection string → paste it into `DATABASE_URL`. Local MongoDB/Postgres installs work too — point `DATABASE_URL` at `localhost` instead.

### 6.3 Create the env file
```bash
cp .env.example .env        # then edit .env
```
- `DATABASE_URL` — the connection string above (works out of the box here).
- `JWT_SECRET` — any long random string; used to sign login tokens.

### 6.4 Install dependencies
```bash
npm install
```

### 6.5 Create the tables (schema → database)
```bash
npx drizzle-kit push
```
(drizzle-kit reads `src/db/schema.ts` and creates the tables.)

### 6.6 Seed realistic demo data
```bash
npx tsx scripts/seed.ts
```

### 6.7 Run the tests (optional but encouraged)
```bash
npx vitest run tests        # 18 tests should pass
```

### 6.8 Start the app
```bash
npm run dev                 # development
# or: npm run build && npm run start   # production mode
```

Open **http://localhost:3000** — you'll be redirected to login.

### 6.9 Demo accounts (created by the seed)

| Role | Email | Password | Persona |
|---|---|---|---|
| **Admin** | `admin@habitwealth.app` | `Admin@123` | manages the platform |
| User | `priya@example.com` | `Demo@123` | salaried professional, Pune |
| User | `arjun@example.com` | `Demo@123` | student on a stipend, Delhi |
| User | `meera@example.com` | `Demo@123` | freelancer, Bengaluru |
| User | `aarav@example.com` | `Demo@123` | couple saving for a house, Jaipur |

### 6.10 Reseeding (start fresh)
The seed refuses to run twice. To reset:
```bash
psql "$DATABASE_URL" -c "TRUNCATE users, income_sources, categories, transactions, habits, habit_logs, savings_goals, goal_contributions, wealth_items, net_worth_snapshots, feedback RESTART IDENTITY CASCADE"
npx tsx scripts/seed.ts
```

---

## 7. Understanding the database

**Relationships in one picture:**

```
users ─┬─< income_sources      (one user → many sources)
       ├─< transactions         (one user → many income/expense rows)
       ├─< habits ──< habit_logs (one habit → many completion logs)
       ├─< savings_goals ──< goal_contributions
       ├─< wealth_items          (kind = investment | asset | liability)
       ├─< netWorthSnapshots     (one per user per month)
       └─< feedback              (tickets the admin answers)
categories                        (userId NULL = global defaults for everyone)
```

Each table's columns are documented inline in **`src/db/schema.ts`** (read it — it's written for you).

Key design choices to notice:
- **Foreign keys**: `transactions.user_id` stores the owner's id — same job as MongoDB's `ref`.
- **Unique index** `habit_logs (habit_id, period_key)` makes *one completion per period* physically impossible, even on double-clicks.
- **Indexes** on `(user_id, date)` keep dashboard queries fast at scale.
- **Dates are stored as `YYYY-MM-DD` strings** (no time part) → almost no timezone bugs.

**Browse the data** with any SQL GUI (TablePlus, DBeaver, the Neon/Supabase dashboards) — the equivalent of MongoDB Compass.

---

## 8. Understanding the API

### 8.1 One full route → "controller" → model example

Take **POST /api/habits/complete** (mark a habit done):

```ts
// src/app/api/habits/complete/route.ts  (the ROUTE + CONTROLLER in one file)
export async function POST(request: Request) {
  const auth = await requireUser();              // 1. middleware: who are you?
  if (isDenied(auth)) return auth;               //    → 401 if logged out
  const habitId = Number((await request.json()).habitId);
  // 2. ownership check: load habit WHERE id AND user_id match
  const habit = await db.select().from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, auth.id)));
  // 3. business rule: already logged this period? → friendly 409
  // 4. MODEL: insert a row into habit_logs (schema.ts defined its shape)
  await db.insert(habitLogs).values({ habitId, userId: auth.id, periodKey, ... });
  return ok(inserted[0], "Nice! Streak continues.");
}
```

The **model** is `habitLogs` from `src/db/schema.ts`; the **controller logic** (checks, rules) lives inside the route; the **shared service** code (e.g. snapshot recalculation) lives in `src/lib/`. This separation = MERN's *routes → controllers → services → models*, just colocated by feature.

### 8.2 Full endpoint table

| Method | URL | Access | What it does |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create account (validation, duplicate check), auto-login |
| POST | `/api/auth/login` | public | Verify credentials, set session cookie (rate-limited) |
| POST | `/api/auth/logout` | user | Clear session cookie |
| GET | `/api/auth/me` | user | "Who am I" for the frontend |
| GET | `/api/users/profile` | user | Read my financial profile |
| PUT | `/api/users/profile` | user | Update profile (targets, occupation…) |
| GET | `/api/income-sources` | user | List my income sources |
| POST | `/api/income-sources` | user | Add a source |
| PUT | `/api/income-sources/:id` | user | Update a source |
| DELETE | `/api/income-sources/:id` | user | Delete a source |
| GET | `/api/categories` | user | Global + my custom categories |
| POST | `/api/categories` | user | Add a custom category |
| GET | `/api/transactions` | user | Paginated list; filters `type, category, from, to, page` |
| POST | `/api/transactions` | user | Add income/expense |
| PUT | `/api/transactions/:id` | user | Edit |
| DELETE | `/api/transactions/:id` | user | Delete |
| GET | `/api/transactions/summary?month=` | user | Monthly report stats (aggregated) |
| GET | `/api/transactions/report?month=` | user | **CSV download** |
| GET | `/api/habits` | user | Habits + computed streaks + dueToday + presets |
| POST | `/api/habits` | user | Create (also used by presets) |
| PUT | `/api/habits/:id` | user | Edit / pause / resume |
| DELETE | `/api/habits/:id` | user | Delete habit + its logs |
| POST | `/api/habits/complete` | user | Mark done for current period (1 per period) |
| GET | `/api/goals` | user | Goals with % complete, pace, ETA |
| POST | `/api/goals` | user | Create a goal |
| PUT | `/api/goals/:id` | user | Edit / mark completed |
| DELETE | `/api/goals/:id` | user | Delete goal + history |
| GET | `/api/goals/:id/contributions` | user | Contribution history |
| POST | `/api/goals/:id/contributions` | user | Deposit/withdraw (auto-completes at target) |
| GET | `/api/wealth` | user | Items + totals + snapshot history |
| POST | `/api/wealth` | user | Add investment/asset/liability |
| PUT | `/api/wealth/:id` | user | Update (e.g. new current value) |
| DELETE | `/api/wealth/:id` | user | Delete |
| POST | `/api/wealth/snapshot` | user | "Save today's snapshot" button |
| GET | `/api/dashboard` | user | **Combined** dashboard payload |
| GET | `/api/feedback` | user | My tickets (+ admin replies) |
| POST | `/api/feedback` | user | Submit issue/complaint |
| GET | `/api/admin/users?q=` | **admin** | Search users + summary counts |
| PUT | `/api/admin/users/:id` | **admin** | Activate / deactivate |
| GET | `/api/admin/analytics?format=csv` | **admin** | KPIs + monthly activity (+CSV) |
| GET | `/api/admin/feedback?status=` | **admin** | Ticket queue |
| PUT | `/api/admin/feedback/:id` | **admin** | Reply / change status |
| GET | `/api/health` | public | Uptime/health check |

> Every "user" route filters by the **logged-in user's id** (see the comment in `income-sources/route.ts`). That's what stops user A from reading user B's data — never trust an id coming from the URL alone.

### 8.3 Test the API with curl (or Postman/Thunder Client)

```bash
# 1. Login (saves the cookie to cookies.txt)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@example.com","password":"Demo@123"}'

# 2. Call a protected endpoint with the cookie
curl -b cookies.txt http://localhost:3000/api/dashboard | json_pp

# 3. Add an expense
curl -b cookies.txt -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":349,"category":"Food","date":"2026-02-11","note":"Zomato order"}'

# 4. Try (and fail) to reach admin data as a normal user → "Admins only."
curl -b cookies.txt http://localhost:3000/api/admin/analytics
```

In **Postman/Thunder Client**: same requests — just remember that cookies are handled automatically once you log in through the client, and every response follows the `{ success, message, data }` envelope.

---

## 9. Understanding the frontend

- **Routing**: folders under `src/app` map to URLs (`src/app/(app)/goals/page.tsx` → `/goals`). `(app)` & `(auth)` are *route groups* — parentheses don't appear in URLs but their `layout.tsx` wraps child pages (sidebar vs no sidebar).
- **State**: `useState` holds component-local data (form fields, fetched lists). `useEffect` = "run this when the component mounts / deps change" — that's where we fetch API data.
- **Context**: `AppShell.tsx` creates an **AuthContext** so any component can call `useAuth()` and get the logged-in user without prop-drilling.
- **Axios**: `src/lib/client.ts` is the single place that knows `baseURL: "/api"`, sends cookies, and unwraps `{success,message,data}`.
- **Protected routes**: two layers — `src/middleware.ts` redirects logged-out visitors to `/login` (and non-admins away from `/admin`), and every API route re-verifies the session (never rely on UI hiding alone).
- **Charts**: Recharts draws SVG from plain arrays:
  ```tsx
  <BarChart data={[{month:"2026-02", income:42000}, ...]}>
    <XAxis dataKey="month" /><Bar dataKey="income" fill="#3d7dd8" />
  </BarChart>
  ```
  The shape of the API data was *designed* to drop straight into charts.
- **Loading / empty / error**: every page handles all three (skeletons via `.skeleton` CSS, `EmptyState`, `ErrorBanner` in `components/ui.tsx`).

---

## 10. Authentication explained simply

1. **Register** → server hashes your password with **bcrypt** (one-way: hash can verify but never reveal) and stores only the hash.
2. **Login** → server compares the password to the stored hash (`bcrypt.compare`). Same error message whether email OR password is wrong (stops account-guessing).
3. Success → server creates a **JWT** (a signed token saying "user 2, role user, expires in 7 days") using `JWT_SECRET`, and places it in an **httpOnly cookie** — JavaScript can't read it (XSS protection) but the browser sends it with every request automatically.
4. **Protected pages** → middleware verifies the token's signature before rendering; **protected APIs** → `requireUser()` verifies again and loads the fresh user row (also blocks deactivated accounts).
5. **Admin-only** → same token also carries `role`; `requireAdmin()` additionally demands `role === "admin"`. Every layer checks: hiding a button is UI, checking the role is security.
6. **Logout** → the cookie is deleted; the stateless server has nothing to clean up.

---

## 11. How the financial logic works (with numbers)

All in `src/lib/finance.ts`, unit-tested in `tests/finance.test.ts`.

**Streaks** — a habit's completions are stored as *period keys*: `2026-02-11` (daily), `2026-W07` (weekly, ISO Mon–Sun), `2026-02` (monthly). `computeStreaks` walks backwards from today:
```
logs: Feb 8, 9, 10  · today is Feb 11 (not logged yet)
→ currentStreak = 3   (grace: today isn't over, chain alive)
logs: Feb 8, 10     · the 9th fully passed with no log
→ currentStreak = 1   (chain broke on the missed day)
```
longestStreak sorts all keys and finds the best consecutive run anywhere in history. Timezone care: logs store calendar dates, noon-based cursors, month-overflow pinned to the 1st.

**Net worth** — `netWorth = savings + investments(current value) + assets − liabilities`.
Example: savings ₹50,000 + investments ₹1,20,000 + car ₹2,00,000 − car loan ₹80,000 = **₹2,90,000**. ("Savings" = all income ever logged − all expenses ever logged.)

**Goal progress** — `percent = current/target × 100` (clamped 0–100). *On track* when moneyProgress ≥ 90% of timeProgress since creation; *ETA* = `remaining ÷ average monthly contributions`. Example: ₹30,000 to go at ₹5,000/month → ~6 months.

**Savings rate** — `(income − expense) / income × 100`. Income ₹50,000, expenses ₹39,000 → **22%**. Guarded against ÷0.

**Rounding pitfall** — `0.1 + 0.2 === 0.30000000000000004` in JavaScript. Banks store integer paise; this project stores decimals but *always* rounds with `round2()` before saving. Amount limits (positive, ≤ 1 crore) are validated server-side.

---

## 12. Testing the app

**Automated** — `npx vitest run tests` (18 tests): daily/weekly/monthly streaks, missed days, month boundaries, net worth incl. negative, savings rate ÷0, rounding, completion rate.

**Manual checklist**

*As a user*
- [ ] Register rejects short passwords & duplicate emails with friendly messages
- [ ] Login works; refreshing keeps you logged in; logout works
- [ ] Add/edit/delete an expense; filters + pagination work
- [ ] CSV downloads and opens in Excel/Sheets
- [ ] Add a preset habit → mark done → streak = 1; clicking again says "already completed"
- [ ] Create goal → add contribution → progress % and ETA update; reach target → auto-completed badge
- [ ] Add an investment → net worth card + snapshot update → "Save today's snapshot" works
- [ ] Dashboard insights mention your real numbers
- [ ] Submit a feedback ticket

*As an admin* (`admin@habitwealth.app` / `Admin@123`)
- [ ] Overview KPIs render; CSV downloads
- [ ] Search finds a user; deactivate → that user can no longer log in; reactivate restores access
- [ ] Feedback queue: reply + move ticket open → in progress → resolved; user sees the reply on their Profile page
- [ ] A normal user visiting `/admin` is redirected away; `/api/admin/*` returns "Admins only."

---

## 13. Common errors & fixes

| Symptom | Cause | Fix |
|---|---|---|
| `JWT_SECRET is not set` | missing env | add it to `.env`, restart dev server |
| `DATABASE_URL is required` / connection refused | DB not running / wrong URL | check `.env`; for local: `psql "$DATABASE_URL" -c "select 1"` |
| `relation "users" does not exist` | schema not pushed | `npx drizzle-kit push` |
| Login works but every page bounces to /login | cookie blocked / clock skew | use `localhost` not random IPs; clear cookies |
| "Invalid email or password" with correct data | using dev hash on reseeds | re-run seed after TRUNCATE; passwords are `Demo@123`/`Admin@123` |
| CORS error in console | calling the API from another origin | this app is same-origin (CORS-free); cross-origin needs an `Access-Control-Allow-Origin` header + your domain |
| Port 3000 in use | another dev server | `lsof -i :3000` then kill it, or `PORT=3001 npm run dev` |
| Blank page after edit | JS error | open DevTools console; check the terminal too |
| Charts not showing | empty data or 0 height | verify API returns rows; chart parents need an explicit `h-64`-style height (already set) |
| Dates off by one day | timezone mixing | we store `YYYY-MM-DD` — never `new Date(string)` without a time part; keep using the `dates.ts` helpers |
| Seed says "already seeded" | safety guard | see section 6.10 (TRUNCATE, then reseed) |
| Streak looks wrong "after midnight" | period boundaries | streaks use local calendar days and ISO (Mon–Sun) weeks — see `dates.ts` comments |

---

## 14. Production preparation

**Env vars:** set `DATABASE_URL` (production DB) and a strong `JWT_SECRET` (`openssl rand -hex 32`) in the host's dashboard. Never commit `.env`.

**Build:** `npm run build && npm run start`. The same server serves UI + API.

**Security & privacy checklist**
- [x] bcrypt password hashing (cost 10)
- [x] JWT in httpOnly, `sameSite=lax` cookies; `secure` automatically on in production
- [x] Security headers (helmet-equivalent) in `next.config.ts`
- [x] Rate limiting on login/register
- [x] Server-side validation on every mutating endpoint
- [x] Ownership filters on every user query (row-level privacy)
- [x] Admin routes re-check role server-side
- [x] Secrets only in env vars
- [x] HTTPS handled by the hosting platform (Vercel/Render terminate TLS)
- **"Encryption in transit / at rest" for this app:** *in transit* = data between browser and server is scrambled by **HTTPS** (free with the hosts below). *At rest* = the database files themselves are encrypted on disk — managed Postgres providers (Neon/Supabase/Render, like MongoDB Atlas) do this by default. You get both without writing code — just don't disable them.

---

## 15. Deployment guide (get your LIVE link)

This app deploys as **one unit** (frontend + API together) — simpler than the split MERN deploy, and this README still maps each step to the classic Express-on-Render/Vite-on-Vercel variant.

### 15.1 Deploy to Vercel (recommended, everything in one)
1. Push the repo to GitHub (section 16).
2. vercel.com → *Add New* → *Project* → import the repo. Vercel auto-detects Next.js (no build settings needed).
3. *Environment Variables*: add `DATABASE_URL` and `JWT_SECRET`.
4. Deploy → you get `https://your-app.vercel.app`.

*SPA refresh note:* classic Vite SPAs need a rewrite so refreshing `/goals` doesn't 404 (Vercel: `vercel.json` with `{"rewrites":[{"source":"/(.*)","destination":"/"}]}`; Netlify: `_redirects` with `/* /index.html 200`). **Next.js already handles real URLs natively** — nothing to configure.

### 15.2 Classic split variant (Express on Render — for reference)
- Render → *New Web Service* → connect repo → root `server/` → build `npm install` → start `node server/index.js`. Add env vars. **Free-tier sleep:** idle services pause and take ~30–60 s to wake (cold start) — fine for demos; ping it once before presenting.
- Frontend on Vercel/Netlify: Vite build with `VITE_API_URL=https://your-api.onrender.com`, add the SPA rewrite from 15.1, then update CORS on the API to allow the frontend's live URL.

### 15.3 Production database
- Neon/Supabase: create project → copy the `postgresql://…` string → production `DATABASE_URL`.
- **Run migrations + seed safely:** run once from your laptop pointed at the production DB:
  ```bash
  DATABASE_URL="postgresql://prod-url" npx drizzle-kit push
  DATABASE_URL="postgresql://prod-url" npx tsx scripts/seed.ts
  ```
  (Then optionally TRUNCATE the demo users and register real accounts.)

### 15.4 Verify the deployment
- [ ] Live URL loads, login page appears over **https**
- [ ] Demo logins work (data present = seed ran against prod DB)
- [ ] Add an expense → dashboard changes → refresh still fine on deep URLs
- [ ] `/api/health` returns `{ ok: true }`
- [ ] Admin login + admin panel KPIs render
- [ ] Logout works; logged-out visit to `/dashboard` redirects to `/login`

---

## 16. Git & GitHub basics

```bash
# .gitignore already excludes: node_modules, .env, .next
git init
git add .
git commit -m "HabitWealth: financial habit builder & wealth tracker"
git branch -M main
git remote add origin https://github.com/<you>/financial-habit-tracker.git
git push -u origin main
```
Golden rule: `git status` should never list `.env`. If a secret is ever committed, rotate it immediately — deleting the file in a later commit does NOT erase history.

---

## 17. KPIs — how the app tracks them

Defined in `src/app/api/admin/analytics/route.ts`:
- **Active users (DAU/WAU/MAU)** — distinct users with a transaction, habit log or contribution in the last 1/7/30 days (a SQL `UNION` + `COUNT DISTINCT`).
- **Habit completion rate** — this month's completions ÷ (active daily habits × days elapsed) × 100.
- **Average savings-goal completion** — mean of `LEAST(current/target, 1)` across all goals × 100 (caps over-funding at 100%).
- **Engagement rate** — `WAU ÷ total users × 100`: are people coming back weekly?
- **Monthly financial activity** — transactions grouped by month for 6 months (chart + CSV export).

---

## 18. PRD summary (copy into your document)

- **Problem:** Students and young professionals fail to save consistently and rarely see their overall wealth trend; budgeting apps track money but not *habits* or *net worth momentum*.
- **Objectives:** (1) habit formation around money (save, log, invest, review); (2) transparent expense/income tracking with reports; (3) goal setting with pace feedback; (4) a single net-worth growth curve.
- **Scope:** manual entry only; INR default (configurable); web app; user + admin roles. Out of scope: bank sync, trading, AI advice.
- **User flow:** register → set financial profile → log income/expenses → adopt habit presets → fund goals → record investments/assets → watch dashboard insights → monthly snapshot builds the growth line.
- **Admin flow:** login → overview KPIs → search/manage users (privacy-safe) → triage feedback tickets → export activity CSV.
- **Assumptions:** users self-report accurately; one currency per deployment; snapshots monthly.
- **Constraints:** free-tier hosting (cold starts), no external banking APIs, rule-based insights only.
- **Expected impact:** measurable daily/weekly engagement (DAU/WAU), habit completion ≥ 50% for engaged users, visible net-worth growth month over month, and a transferable template for further fintech learning.

---

## 19. Final pre-submission checklist

- [ ] All 8 pages open without console errors (login/register, dashboard, tracker, habits, goals, wealth, profile, admin)
- [ ] 404 page works (`/anything-weird`)
- [ ] Validation messages are friendly (register short password; negative amounts; duplicate email)
- [ ] `npx vitest run tests` passes (18/18)
- [ ] Seeded demo data present (priya/arjun/meera/aarav + admin)
- [ ] Admin login works; user blocked from `/admin`; API says "Admins only."
- [ ] CSV downloads (transactions + admin analytics)
- [ ] Loading skeletons, empty states, error banners visible when appropriate
- [ ] `.env` NOT in git; `JWT_SECRET` is long and random in production
- [ ] LIVE link opens over HTTPS and `/api/health` is OK

---

## 20. Future enhancements (deliberately out of scope today)

Bank-account integration & automatic transaction import · investment portfolio tracking (live NAV/prices) · automated, emailed monthly financial reports (Nodemailer — note free hosts sleep, so schedule from a cron service) · mobile app (React Native) · an AI financial advisor · email habit reminders · multi-user shared goals · PDF reports (CSV already included).

---

## 21. Learning resources

- React: https://react.dev/learn (official, modern)
- Next.js App Router: https://nextjs.org/learn
- SQL basics: https://www.postgresqltutorial.com · MongoDB equivalent: university.mongodb.com
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- JWT: https://jwt.io/introduction · bcrypt: search "why bcrypt" on OWASP.org
- Recharts: https://recharts.org/en-US/examples
- Tailwind: https://tailwindcss.com/docs
- HTTP/REST: https://developer.mozilla.org/en-US/docs/Web/HTTP
- Vitest: https://vitest.dev/guide/

---

## 22. Glossary (beginner terms used in this project)

| Term | Plain meaning |
|---|---|
| **API** | A menu of URLs your frontend calls to ask the server for data/actions |
| **REST** | API style: nouns as URLs (`/api/goals/5`), verbs as methods (GET/POST/PUT/DELETE) |
| **JWT** | Signed token proving "you are user #2" — the session pass, stored in a cookie |
| **Middleware** | Code that runs *before* a route (auth guard, rate limit) like airport security |
| **Schema / model** | The definition of a table's columns and types (Drizzle = Mongoose's role) |
| **Migration / push** | Applying schema changes to the actual database |
| **Aggregation** | Database-side maths (SUM/GROUP BY) instead of summing rows in JavaScript |
| **Index** | Lookup structure that makes filtered queries fast (textbook index) |
| **Foreign key** | A column storing another row's id — the "belongs to" link |
| **Hook** | React function for state/effects (`useState`, `useEffect`…) |
| **Context** | React's shared data box — read the logged-in user anywhere via `useAuth()` |
| **Protected route** | Page/API that requires a valid session (admin routes also require the role) |
| **Streak** | Count of consecutive completed periods (days/weeks/months) |
| **Net worth** | What you own minus what you owe |
| **Snapshot** | A saved copy of your wealth totals for one month (powers the trend line) |
| **Rate limiting** | "Max 10 tries per 10 min" — slows down password guessing |
| **CORS** | Browser rule about which websites may call your API across domains |
| **Env variable** | Config kept outside code (`.env`): secrets, URLs, per-environment values |
| **CSV** | Comma-separated values — plain-text spreadsheet export |
| **DAU/WAU/MAU** | Active users in the last day / week / month |

---

*Built as a learning project. Read `src/lib/finance.ts` next — it's the heart of the app and written to be read.*
