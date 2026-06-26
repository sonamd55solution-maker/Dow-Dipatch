# Department of Water (DoW) — Dispatch Number Booking System
### Complete Setup Guide & System Explanation

**Ministry of Energy & Natural Resources, Bhutan**
Stack: HTML · CSS · Vanilla JavaScript · Supabase (Postgres + Auth) · GitHub Pages

---

## What this system does

The DoW Dispatch Booking System lets staff book official government dispatch numbers without collisions — two people submitting at the exact same second will always receive different numbers. Every number follows the format:

```
MoENR/DoW/{FileIndex}/{FinancialYear}/{SequentialNumber}
Example:  MoENR/DoW/11/2025-2026/0008
```

Numbers reset to `0001` every 1 July (start of Bhutan's financial year). Bookings are valid for 7 days; unused ones expire automatically.

---

## Project File Structure

```
dow-dispatch/
├── index.html              ← Entry point: redirects to dashboard or login
├── login.html              ← Login + Register page
├── dashboard.html          ← Staff & Admin dashboard
├── book.html               ← Book a dispatch number
├── search.html             ← Search / filter all bookings
├── admin/
│   └── index.html          ← Admin-only panel (bookings, users, divisions, reports)
├── assets/
│   ├── css/
│   │   └── styles.css      ← Complete shared design system
│   └── js/
│       ├── config.js       ← YOUR Supabase URL + anon key (edit this)
│       ├── supabaseClient.js ← Creates the shared Supabase client
│       ├── auth.js         ← Session/role guard helpers
│       ├── ui.js           ← Sidebar shell renderer + shared helpers
│       ├── login.js        ← Login page logic
│       ├── dashboard.js    ← Dashboard page logic
│       ├── book.js         ← Book dispatch page logic
│       ├── search.js       ← Search page logic
│       └── admin.js        ← Full admin panel logic
└── supabase/
    ├── schema.sql          ← Run FIRST: tables, functions, RLS policies
    └── seed.sql            ← Run SECOND: sample divisions & file indexes
```

---

## STEP-BY-STEP SETUP

---

### STEP 1 — Create your Supabase project

1. Go to **https://supabase.com** and sign up (free).
2. Click **New Project**, choose a name (e.g. `dow-dispatch`), set a database password, choose a region close to Bhutan (Singapore), then click **Create new project**.
3. Wait about 2 minutes for the project to finish provisioning.

---

### STEP 2 — Run the database schema

This creates all the tables, the booking function, and the security rules.

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project, copy **all** its contents, paste into the SQL Editor, click **Run** (or press Ctrl+Enter).
4. You should see "Success. No rows returned."

**What schema.sql creates:**

| Object | Purpose |
|---|---|
| `profiles` table | One row per user — stores name, email, role (staff/admin), active status |
| `divisions` table | Dropdown options for the booking form |
| `file_indexes` table | Dropdown options for the booking form |
| `dispatch_counters` table | One row per financial year; holds the running counter |
| `bookings` table | Every booking ever made (records are never deleted) |
| `get_financial_year()` | SQL function: returns "2025-2026" from a timestamp |
| `book_dispatch()` | The core booking function — called from the browser via RPC |
| `expire_overdue_bookings()` | Marks overdue Reserved bookings as Expired |
| RLS policies | Security: staff can only see their own bookings; admins see everything |
| `handle_new_user` trigger | Auto-creates a profile row when someone registers |

---

### STEP 3 — Run the seed data

This adds sample divisions and file indexes so the booking form is not empty on first use.

1. Still in SQL Editor, click **New query**.
2. Open `supabase/seed.sql`, copy all, paste, click **Run**.
3. You should see "Success."

You can edit or remove these later from the Admin Panel — they are just starting data.

---

### STEP 4 — Get your API keys

1. In Supabase, click **Project Settings** (gear icon, bottom of left sidebar).
2. Click **API**.
3. Copy two things:
   - **Project URL** — looks like `https://abcdefghijklmn.supabase.co`
   - **anon public** key — a very long string starting with `eyJ...`

The `anon` key is safe to put in frontend code. All real security is enforced by Postgres RLS policies, not by keeping this key secret.

---

### STEP 5 — Configure the frontend

Open `assets/js/config.js` and replace the placeholder values:

```js
const SUPABASE_CONFIG = {
  url:     "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-SUPABASE-ANON-KEY",
};
```

Save the file. That is the **only** file you need to edit.

---

### STEP 6 — Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `dow-dispatch`).
2. Push this entire project folder to that repository:
   ```bash
   git init
   git add .
   git commit -m "Initial deploy"
   git remote add origin https://github.com/YOUR-ORG/dow-dispatch.git
   git push -u origin main
   ```
3. In the repository on GitHub, go to **Settings → Pages**.
4. Under **Source**, select **Deploy from a branch**, choose `main`, folder `/` (root), click **Save**.
5. GitHub gives you a URL: `https://YOUR-ORG.github.io/dow-dispatch/`
6. The app is live. No build step, no server, no Node.js needed.

**Also enable Supabase Auth for your domain:**
- In Supabase, go to **Authentication → URL Configuration**.
- Add your GitHub Pages URL to **Site URL** and **Redirect URLs**.

---

### STEP 7 — Create your first Admin account

1. Open your deployed app (or `login.html` locally) and click **Register here**.
2. Enter your name, your `@dow.gov.bt` email, and a password. Click **Create Account**.
3. Go to Supabase **SQL Editor**, run:
   ```sql
   update public.profiles
     set role = 'admin'
     where email = 'your-actual-email@dow.gov.bt';
   ```
4. Log out and log back in.
5. You will now see **Admin Panel** in the sidebar.

---

## How the System Works — Full Explanation

### Authentication flow

```
User opens app
    ↓
index.html checks for existing session
    ↓
Session exists?  →  YES  →  dashboard.html
                 →  NO   →  login.html
```

Supabase handles all password hashing, session tokens, and token refresh automatically. Sessions persist in browser localStorage; `auth.js` reads the session on every page load and redirects to login if missing.

### Role system

There are exactly two roles:

| Role | What they can do |
|---|---|
| **Staff** | Log in, book dispatch numbers, search/view their own bookings only |
| **Admin** | Everything staff can do, plus: view all bookings, approve/cancel/edit bookings, manage divisions, manage file indexes, promote/demote users, view reports |

The `auth.js` file's `requireAuth()` function is called at the top of every page's JS. If not logged in → redirected to login. If not admin on an admin page → redirected to dashboard.

### How dispatch numbers are generated (atomically)

This is the most critical part of the system. Two people must never receive the same number.

The `book_dispatch()` function in Postgres does this:

```
1. Validate the user is logged in
2. Confirm division and file index are active
3. Get current financial year (e.g. "2025-2026")
4. Run:  INSERT INTO dispatch_counters (financial_year, last_number)
         VALUES ('2025-2026', 1)
         ON CONFLICT (financial_year)
         DO UPDATE SET last_number = last_number + 1
         RETURNING last_number
   → This is atomic. Postgres locks the row. Even 100 simultaneous bookings
     get sequential numbers: 1, 2, 3, 4...
5. Build the number: MoENR/DoW/11/2025-2026/0001
6. Insert into bookings table with status 'Reserved'
7. Return the new booking row to the browser
```

The counter resets automatically each new financial year because a new row is inserted for each FY.

### Booking status lifecycle

```
[Book Dispatch clicked]
       ↓
    Reserved  ──────────────────────────────────────→  Expired (after 7 days)
       ↓                                                    ↑
    [Admin approves]                            [Nobody acts within 7 days]
       ↓
    Approved
       ↓
    [Admin marks used]    [Admin cancels]
       ↓                        ↓
     Used                  Cancelled
```

Records are **never deleted** — only their `status` field changes. This creates a complete audit trail.

### Lazy expiry (no server cron needed)

When the dashboard, search page, or admin panel loads, the first thing it does is call:
```js
await window.supabaseClient.rpc('expire_overdue_bookings')
```
This runs the Postgres function that marks any overdue `Reserved` bookings as `Expired`. So the status is always accurate the moment anyone views the data — no background job needed.

### Security (Row Level Security)

The app has no backend server. GitHub Pages only serves static HTML/CSS/JS files. All security is enforced by **Postgres Row Level Security (RLS)** policies set in `schema.sql`:

```
Staff user SELECT bookings → RLS: can only see rows where booked_by = their user ID
Admin user SELECT bookings → RLS: can see all rows
Staff INSERT booking       → Only via book_dispatch() RPC (security definer bypasses RLS)
Staff UPDATE bookings      → Blocked at database level
Admin UPDATE bookings      → Allowed (to change status, subject, etc.)
dispatch_counters          → Never accessible directly by any user — only via book_dispatch()
```

Even a technically savvy user inspecting network requests cannot bypass these — the database itself refuses unauthorized operations.

---

## Day-to-Day Usage Guide

### Booking a dispatch number (Staff)
1. Log in → click **Book Dispatch Number** in the sidebar.
2. Select your Division and File Index from the dropdowns.
3. Enter the Subject, Recipient, and your name in Requested By.
4. Click **Book Dispatch** — your number appears instantly.
5. Note the number down. It is valid for 7 days pending approval.

### Approving a booking (Admin)
1. Go to **Admin Panel → All Bookings** tab.
2. Find the booking (filter by Status: Reserved to see pending ones).
3. Click **Approve** — status changes to Approved.
4. Optionally click **Mark Used** when the physical letter is dispatched.

### Adding a new Division or File Index (Admin)
1. Go to **Admin Panel → Divisions** (or File Indexes) tab.
2. Click **+ Add Division** (or **+ Add File Index**).
3. Fill in the name/code and click **Save**.
4. The new option appears in the booking form immediately — no code change needed.

### Promoting a Staff member to Admin (Admin)
1. Go to **Admin Panel → Users** tab.
2. Find the user, click **Make Admin**.
3. They must log out and log back in to see the Admin Panel link.

### Disabling an account (Admin)
1. Go to **Admin Panel → Users** tab.
2. Find the user, click **Disable**.
3. They are immediately blocked — their next page load or API call will fail.

---

## Optional: Scheduled expiry with pg_cron

Bookings expire lazily (on page load). If you want expiry to run in the background even when nobody has the app open (useful for external reporting), you can enable `pg_cron` if your Supabase plan supports it:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'expire-dispatch-bookings',
  '0 * * * *',  -- every hour
  $$ select public.expire_overdue_bookings(); $$
);
```

This is optional — the app works correctly without it.

---

## Troubleshooting

| Problem | Likely Cause & Fix |
|---|---|
| Blank dropdowns on Book page | No active divisions/file indexes — add them in Admin Panel → Divisions |
| "Invalid or inactive division" error | Division was disabled after the form loaded — refresh the page |
| Login works but immediately redirects back | `profiles` row missing or `is_active = false` — check the profiles table in Supabase |
| Admin Panel not visible after promotion | User needs to log out and log back in |
| Dispatch number not generating | `book_dispatch` RPC may not exist — re-run schema.sql |
| "Not authenticated" error on booking | Session expired — log out and log back in |
| GitHub Pages shows 404 | Make sure the Pages source is set to the root `/` folder of the `main` branch |
| Email confirmation loop | In Supabase Auth settings, disable "Confirm email" for internal use, or add your Pages URL to redirect URLs |
