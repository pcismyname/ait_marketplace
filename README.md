# Pass It On — AIT Circular Marketplace (Buy, Sell & Rent)

A C2B2C circular marketplace for students of the Asian Institute of Technology,
built for AST02.21 E-Business Development and Technology (final due 19 November 2026).
Students buy, sell and **rent** furniture, electronics, bikes, textbooks and kitchen
gear; the platform holds rental deposits in escrow, runs a 48-hour dispute window,
and matches outgoing students' listings to incoming students' needs around the
academic calendar.

**All payments are simulated.** There is no payment gateway (not even a test mode):
checkout records the method the student picks (PromptPay, card or wallet) and every
hold, payout and refund is a row in an in-app ledger. The app says
"Demo mode — payments are simulated" wherever money moves.

## Documentation

| File | What |
|---|---|
| [docs/Proposal.md](docs/Proposal.md) | What and why |
| [docs/BusinessRules.md](docs/BusinessRules.md) | **Source of truth for every fee, deposit, escrow and dispute rule** |
| [docs/Database.md](docs/Database.md) | Schema, state machines, RPCs, RLS, storage, how to run and deploy the database |
| [docs/Timeline.md](docs/Timeline.md) | Scope and dates |
| [docs/Design.md](docs/Design.md) | Visual design system |
| [docs/UserFlows.md](docs/UserFlows.md), [figures/](figures/) | Routes and the four user-flow diagrams |
| [action_items.md](action_items.md) | Task list (P0 / P1 / P2) |
| [audit.md](audit.md) | What is built vs planned, page by page |
| [tests/e2e/RESULTS.md](tests/e2e/RESULTS.md) | Latest end-to-end run |

## Fees (BusinessRules §2)

| Fee | Who pays | Amount |
|---|---|---|
| Listing | — | Free |
| Rental commission | Renter | 10% of the rental fee |
| Escrow handling fee | Renter | `max(฿30, 3% of the deposit)` |
| Deposit | Renter | Refundable; 30–50% of replacement value, ฿200–฿3,000 |
| Buyer protection (optional, sales) | Buyer | ฿10 + 3% of the price |
| Sale paid in person | — | Free, no protection |
| Premium placement | Lister | ฿49 for 7 days |

Example: mini fridge ฿250/month with an ฿800 deposit → 250 + 25 + 30 + 800 = **฿1,105**.
The owner is paid the rental fee 48 hours after handover; the deposit comes back after
the return, minus `ceil(fee / period days)` per day late; more than 7 days late counts
as missing (full deposit to the owner).

## What's built

| Route | Feature |
|---|---|
| `/`, `/browse` (`/search` redirects) | Seasonal banner, full-text search, filters in the URL (type, category, condition, pickup, price, sort, favourites), featured first |
| `/listing/[id]` | Photos, condition, pickup point, item history, seller rating; **Request to book** (rent) or **Buy now** (sale) |
| `/listing/[id]/checkout` | Protected or in-person sale; pay an approved rental booking (line-by-line quote) |
| `/sell`, `/my-listings`, `/dashboard/listings/[id]/edit` | Create and manage listings with photo upload, deposit rules, premium placement, pause / delete / mark sold |
| `/dashboard/listings/[id]/requests` | Owner approves or declines booking requests |
| `/rentals` | Renting and Lending tabs: pay, handover and return with photos, countdowns, late fees, rating |
| `/transaction/[id]`, `/transaction/[id]/confirm` | Deal status for both parties: timeline, amounts, 48 h countdown, confirm receipt / return |
| `/dispute/new`, `/dispute/[id]` | File within 48 h with evidence; status and comments |
| `/dashboard/orders`, `/dashboard/wallet`, `/notifications` | Purchases / sales / rentals history, held vs available balance and ledger, in-app notifications |
| `/chat`, `/needs`, `/profile/[userId]` | Realtime chat with unread counts, pre-arrival needs matched server-side, public profiles |
| `/signup`, `/login`, `/verify-email`, `/reset-password`, `/onboarding`, `/dashboard/settings` | `@ait.asia`-only accounts (enforced in the database), onboarding, password reset |
| `/admin/*` | Dashboard counters, dispute queue and resolution (BusinessRules §6 outcomes), listing moderation, users, demo time-travel tools |

Stack: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui on Base UI,
Supabase (Postgres + RLS, Auth, Storage, Realtime, pg_cron). Money and state changes
go through Postgres functions (`supabase/migrations/`); the client wrappers are in
`lib/api/`.

## Run it locally

Prerequisites: Node 20+, Docker Desktop (for the local Supabase stack), and Microsoft
Edge or Chrome for the browser tests.

```bash
npm install
npm run db:start                          # local Supabase (API :54321, Studio :54323, Mailpit :54324)
npx -y supabase@2.122.0 status -o env     # prints the local URL and keys
```

Create `.env.development.local` (git-ignored) from that output:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
SUPABASE_SECRET_KEY=<SECRET_KEY>          # scripts only — never in client code or NEXT_PUBLIC_ vars
```

Then:

```bash
npm run db:reset      # apply migrations to an empty local database
npm run seed:demo     # demo accounts + listings + deals in many states
npm run dev           # http://localhost:3000
```

`next dev` reads `.env.development.local`; `next build` / `next start` read `.env.local`
(production values). Never commit either file.

### Demo accounts

`npm run seed:demo` creates five accounts — owner, renter, buyer, seller and admin, all
`demo.<role>@ait.asia` — and writes their generated passwords to
**`demo-accounts.local.md`** (git-ignored; re-running the seed changes them). The file
also lists which seeded deal is in which state. The admin can fast-forward any deal from
**Admin → Dashboard → Demo tools** to show payouts and auto-release without waiting 48 hours.

Local email (sign-up confirmation, password reset) lands in Mailpit at http://127.0.0.1:54324.

## Scripts

| Command | Needs | What |
|---|---|---|
| `npm run dev` | local stack | Dev server |
| `npm run build`, `npm start` | `.env.local` | Production build / server |
| `npm run lint` | — | ESLint |
| `npm test` | — | `lib/fees.ts` unit tests |
| `npm run test:db` | local stack | Server fee quotes vs `lib/fees.ts` |
| `npm run test:sql` | local stack | pgTAP: every state transition, ledger, RLS (304 checks; data-independent) |
| `npm run test:e2e` | local stack, `npm run dev`, demo accounts | Browser flows in headless Edge → [tests/e2e/RESULTS.md](tests/e2e/RESULTS.md) |
| `npm run demo:flow` | local stack | A rental and a protected sale driven through the RPCs |
| `npm run db:types` | local stack | Regenerate `lib/database.types.ts` after a schema change |
| `npm run seed:demo` | local stack | Reset the demo accounts and their deals |

The E2E flows read credentials from `demo-accounts.local.md` or from
`E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD`, refuse to run against a non-local Supabase,
and create their own "E2E …" listings so they never touch the seeded deals.
`E2E_BASE_URL` points them at another app URL; `E2E_HEADED=1` shows the browser.

## Deploy

Production is a Supabase project plus Vercel (imported from GitHub; every push to
`master` redeploys). Vercel needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Database migrations are pushed by hand after
review — follow [docs/Database.md §9](docs/Database.md) (it also lists the dashboard
settings: auth hook, redirect URLs, pg_cron).
