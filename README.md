# Affiliate Hub: dashboard

The internal tool for the **affiliate (ops) team** and the **finance team**. Built with Next.js 16 (App Router) and TypeScript.

> The project overview, architecture, product decisions and next steps are in the **[backend README](https://github.com/rahul-312/affiliate-backend#readme)**, the main README for all three repos.

## What it does

| Role | Pages |
| --- | --- |
| **Ops** | **Overview**: new applications, pending commissions, approved-unpaid, paid this month. **Affiliates**: filter by status, approve, reject with a reason. **Commissions**: queue by status, approve or reject singly or in bulk (reason required), and *Simulate sale* (demo mode). |
| **Finance** | **Overview**: plus the next payout run. **Commissions**: read-only. **Payouts**: affiliates owed money but missing payout details, create a batch, per-affiliate breakdown, download the CSV, confirm with a payment reference, mark failed items with reasons, cancel a draft. Batches with failures show as *Partially paid: ₹X of ₹Y*, never as "Paid". |

Navigation adapts to the signed-in role. Affiliate accounts are refused, since affiliates use the mobile app.

## Run locally

Requires Node.js ≥ 20.11 and the [backend](https://github.com/rahul-312/affiliate-backend) running (by default on `http://localhost:4000`).

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev                    # http://localhost:3000
```

Sign in with `ops@demo.com` or `finance@demo.com` (password `demo1234`) after running `npm run seed` in the backend.

Other scripts: `npm run build && npm start` (production), `npm run lint`, `npm run typecheck`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL including `/api`. **Inlined at build time**: on Vercel, set it in the project's environment variables *before* building, and redeploy after changing it. |

The backend must allow this dashboard's origin in its `CORS_ORIGINS` (`http://localhost:3000` locally, the Vercel URL in production).

## Deploy (Vercel)

Import the repo and set `NEXT_PUBLIC_API_URL=https://<your-backend>.onrender.com/api`, then deploy. Add the resulting `https://….vercel.app` origin to the backend's `CORS_ORIGINS`.

## Design notes

- **No business logic in Next.js.** There are no API routes or server actions. Every page calls the Express API with the JWT in the `Authorization` header, so the backend is the only place rules live and both clients behave identically.
- Pages are client components behind a client-side role guard in `app/(app)/layout.tsx`. That guard is for UX only: the API enforces every permission.
- The session is kept in a small external store (`useSyncExternalStore`) backed by `localStorage`. Expired tokens are discarded on load, and any `401` signs the user out. An httpOnly-cookie session is on the next-steps list.
- Security headers: a strict CSP whose `connect-src` is pinned to the API origin, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `no-referrer`, HSTS, and no `X-Powered-By`. Affiliate-supplied links are rendered only if they're `http(s)`, with `rel="noopener noreferrer nofollow"`.
- Money is integer paise from the API and formatted only for display. Typed rupee amounts are parsed to paise without floating point.

```
app/
  layout.tsx, page.tsx (→ /overview)      login/page.tsx
  (app)/layout.tsx                         auth + role guard, sidebar
  (app)/overview · affiliates · commissions · payouts · payouts/[id]
lib/        api.ts (fetch wrapper) · auth.tsx (session) · useApi.ts · money.ts · navigation.ts (role → pages) · types.ts
components/ DataTable · StatusBadge · Dialog · ConfirmDialog · SimulateSaleModal · ConfirmPayoutDialog · Sidebar · …
```
