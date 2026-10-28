# Affiliate Hub: dashboard

The internal web dashboard for the **ops team** (approves affiliates and commissions) and the **finance team** (pays affiliates). Built with Next.js 16 (App Router) and TypeScript.

The dashboard has no business logic of its own. Every page calls the [affiliate-backend](https://github.com/rahul-312/affiliate-backend) API.

**Related repos:** [affiliate-backend](https://github.com/rahul-312/affiliate-backend) (the API) · [affiliate-mobile](https://github.com/rahul-312/affiliate-mobile) (Android app for affiliates)

---

## Before you start

| You need | Check it with |
| --- | --- |
| Node.js 22 (anything ≥ 20.11 works) | `node -v` |
| The backend running, with demo data loaded | Open <http://localhost:4000/api/health>. You should see `{"status":"ok","db":"up"}` |

If the backend isn't running yet, follow the setup steps in the [backend README](https://github.com/rahul-312/affiliate-backend#setup) first.

---

## Setup

Run every command from inside the `affiliate-frontend` folder.

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Create your `.env.local` file

```bash
cp .env.example .env.local
```

The default value, `NEXT_PUBLIC_API_URL=http://localhost:4000/api`, points at the local backend. You only need to change it if your backend runs somewhere else.

### Step 3: Start the dashboard

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with one of these accounts:

| Email | Password | Role |
| --- | --- | --- |
| `ops@demo.com` | `demo1234` | Ops |
| `finance@demo.com` | `demo1234` | Finance |

Affiliate accounts can't sign in here. Affiliates use the mobile app.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dashboard on port 3000 and reloads it when you change a file |
| `npm run build` | Builds the production version |
| `npm start` | Runs the production build (run `npm run build` first) |
| `npm run lint` | Checks code style |
| `npm run typecheck` | Checks TypeScript types |

---

## Environment variables

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend URL, including `/api`. It's baked in when you build, so after changing it, restart `npm run dev` or rebuild |

---

## Common problems

| You see | Fix |
| --- | --- |
| Login fails with a network or CORS error | Check that the backend is running, and that its `CORS_ORIGINS` includes `http://localhost:3000`. Restart the backend after changing it |
| Login says the email or password is wrong | Run `npm run seed` in the backend to load the demo accounts |
| Changed `NEXT_PUBLIC_API_URL` but nothing changed | Stop `npm run dev` and start it again |
| First request takes about 30 seconds against the deployed backend | Render's free tier is waking up. Wait and try again |

---

## Deploying to Vercel

1. On Vercel, import this repo.
2. Before the first deploy, add the environment variable `NEXT_PUBLIC_API_URL=https://<your-backend>.onrender.com/api`.
3. Deploy.
4. Copy the dashboard's URL (`https://….vercel.app`) and add it to the backend's `CORS_ORIGINS` on Render.

If you change `NEXT_PUBLIC_API_URL` later, redeploy, because the value is baked in at build time.

---

## What each role can do

| Role | Pages |
| --- | --- |
| **Ops** | **Overview**: new applications, pending commissions, approved-but-unpaid total, paid this month. **Affiliates**: filter by status; approve (and set the commission rate), reject with a reason, change a rate, deactivate or reactivate. **Commissions**: queue by status; approve or reject one at a time or in bulk (reject needs a reason); *Simulate sale* when the backend has `DEMO_MODE=true`. |
| **Finance** | **Overview**: the same numbers plus the next payout run. **Commissions**: read-only. **Payouts**: affiliates owed money but missing payout details; create a batch, see the per-affiliate breakdown, download the CSV, confirm with a payment reference, mark failed items with a reason, cancel a draft. A batch with failures shows as *Partially paid: ₹X of ₹Y*, never as "Paid". |

The sidebar shows only the pages for the signed-in role.

---

## How it works

- **No business logic in Next.js.** There are no API routes or server actions. Pages call the Express API with the JWT in the `Authorization` header, so the dashboard and the mobile app follow exactly the same rules.
- **Role guard for navigation only.** `app/(app)/layout.tsx` redirects users who aren't signed in or have the wrong role. The real permission checks happen in the API.
- **Session.** The token is kept in `localStorage`. Expired tokens are dropped on load, and any `401` from the API signs the user out.
- **Security headers.** A strict Content Security Policy that only allows calls to the API's origin, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `no-referrer` and HSTS. Links supplied by affiliates are shown only if they're `http(s)`.
- **Money.** The API sends whole-number paise, which the dashboard formats only for display. Amounts typed in rupees are converted to paise without floating-point maths.

## Key decisions and tradeoffs

| Decision | Why | Tradeoff |
| --- | --- | --- |
| **Next.js for the dashboard** (not React Native Web) | Staff work on desktops with tables and forms, which Next.js handles well | A different framework from the mobile app (still React and TypeScript) |
| **No business logic in Next.js** | All rules stay in the backend, so the dashboard and app behave the same | Every action needs a call to the backend |
| **One dashboard for ops and finance** | One login and one codebase; the sidebar changes with the role | Both teams share one app, so changes need care for both |
| **Token stored in `localStorage`** | Simple to build for v1 | Less safe than an httpOnly cookie if a script is ever injected |
| **"Partially paid", never "Paid", when items failed** | Finance can see at a glance that some money didn't go out | One more status to explain |
| **Hosted on Vercel** | Free and deploys on every push | `NEXT_PUBLIC_API_URL` needs a redeploy when it changes |

## What we'd add with more time

- **httpOnly-cookie sessions** and **two-factor login** for staff
- **Search, sorting and CSV export** on every table
- **Audit log page** showing who changed what and when
- **Program settings page** to edit the commission rate, minimum payout and rules without a code change
- **Bank statement upload** to match payments automatically
- **Charts** for sign-ups, sales and payouts over time

## Project layout

```text
app/
  layout.tsx, page.tsx          root layout; / redirects to /overview
  login/page.tsx                sign-in page
  (app)/layout.tsx              sign-in and role guard, sidebar
  (app)/overview, affiliates, commissions, payouts, payouts/[id]
lib/
  api.ts                        fetch wrapper for the backend
  auth.tsx                      session
  useApi.ts, money.ts, navigation.ts (role → pages), types.ts
components/
  DataTable, StatusBadge, Dialog, ConfirmDialog, SimulateSaleModal, ConfirmPayoutDialog, Sidebar, …
```
