# AIT Circular Marketplace — Final Project Action Items

**Course:** AST02.21 — E-Business Development and Technology
**Final due:** Thursday, 19 November 2026
**Deliverables:** (1) working website/app, (2) final project report
**Plan written:** 20 October 2026 · **Last aligned with the business rules:** 24 October 2026 (26 days left)

> **Money rules live in [docs/BusinessRules.md](docs/BusinessRules.md)** (decided by the team on 2026-10-07); scope and dates live in [docs/Timeline.md](docs/Timeline.md). If anything in this file disagrees with them, those files win. Rules marked **(open)** there get a placeholder only.

Legend: `[P0]` must ship · `[P1]` should ship if time allows · `[P2]` cut to "Future Work" in the report unless we're ahead of schedule.
Suggested workstreams so everyone has a lane (assign names in the table below):

| Workstream | Scope | Owner |
|---|---|---|
| **A — Backend & escrow** | Supabase schema/RLS, auth, simulated payments and escrow state machine, auto-release, deploy | ______ |
| **B — Frontend, UX & QA** | Remaining pages, polish, responsive checks, testing, screenshots | ______ |
| **C — Report, research & finance** | Report writing, financial model, diagrams, references | ______ |

Everyone cross-reviews one other workstream's output each week.

---

## Business-rule alignment (24 Oct 2026)

This file was checked against BusinessRules.md and Timeline.md. Each mismatch and how it was resolved:

| # | Was in this file | Rule (BusinessRules.md) | Resolution |
|---|---|---|---|
| 1 | 10% commission on every transaction (sale or rental) | §2: 10% commission on **rentals only**; sales are free in person, or the buyer opts into "Pay with protection" = ฿10 + 3% of price | Decisions, fee table, checkout items and report rows rewritten |
| 2 | 4% deposit-handling fee, `DEPOSIT_FEE_RATE = 0.04`, 3/4/5% sensitivity | §2: **escrow handling fee** = `max(฿30, 3% of deposit)`, rounded to the nearest baht | Renamed and recomputed everywhere; sensitivity reframed (done in `lib/fees.ts` on branch fix/business-rules-alignment) |
| 3 | Dispute window 24 h, `RELEASE_WINDOW_HOURS = 24`, 12 h / 2 h reminders | §6: **48 hours**, from handover (sales) or return (rentals) | Changed to 48 h; reminders moved to 24 h and 2 h before close |
| 4 | Gateway in test/sandbox mode, webhook, Omise vs. 2C2P choice, sandbox disclaimer, gateway onboarding risk | §7 + Timeline: **no gateway at all**, not even test mode; payments, escrow, payouts and refunds are simulated in-app state changes | Gateway items removed; Omise appears only in the report's real-launch section |
| 5 | Deposit "set by owner" | §3: platform suggests by category, owner adjusts within 30–50% of replacement value, clamped ฿200–฿3,000; rentals need a deposit ≥ ฿200 | Fee table and listing items updated |
| 6 | Worked examples (sale 100 → 110; rental 1,260) | §2 formulas | Recomputed: mini fridge ฿1,105; ฿1,000 sale = ฿1,000 in person or ฿1,040 with protection |
| 7 | Escrow ledger `paid → held → handover_confirmed → …` | §4 rental states `requested → approved → paid → active → return-pending → released \| disputed → resolved`, `active → overdue → missing` | State machine item rewritten to the rule's states |
| 8 | Not covered | §4: owner payout 48 h after handover; late fee `ceil(rentalFee / periodDays)` per day from the deposit; > 7 days late = missing (full deposit to owner) | New items in 2.4 |
| 9 | Disputes "resolve for buyer/seller" | §6 outcome table; the owner never receives more than the deposit | Admin item rewritten to the outcome table |
| 10 | Premium placement "not billed in the prototype" (open) | §2: ฿49 for 7 days, paid by the lister when enabled | Decision locked; payment simulated like every other charge |
| 11 | Payment methods not specified | §7–8: `promptpay` (default), `card`, `wallet` | Checkout item lists them |
| 12 | Owner approval of bookings was `[P1]` | §4 booking flow: request → owner approves → renter pays | Raised to `[P0]` (it is part of the required flow) |
| 13 | Rentals of items > ~฿6,000 not covered | §3: renting them needs admin approval **(open)** | Placeholder item only |
| 14 | Finance assumptions to be invented | §10 planning numbers (150 rentals/semester, ~฿34 net per rental, lean pilot vs. paid staff) | Finance section now starts from §10 |
| 15 | Section 4 said change "24-48 hrs" to "24 hrs" and add the 4% fee | 48 h; escrow fee `max(฿30, 3%)` | Section 4 rewritten; the figures were redrawn on 24 Oct 2026 (Section 4) |
| 16 | "Replace 'free sales listing' / 'rental commission only' language" | §1–2: listing **is** free and commission **is** rental-only | Item inverted: keep that language, add the optional buyer protection fee |

---

## 0. Decisions

### Locked (per BusinessRules.md, decided 2026-10-07)
- [x] **Rental commission:** 10% of the rental fee, paid by the renter on top at booking. Owner receives the full rental fee.
- [x] **Escrow handling fee (rentals only):** `max(฿30, 3% of deposit)`, rounded to the nearest baht, paid by the renter at booking, **non-refundable** (it pays for holding the deposit and running disputes). Constants `ESCROW_FEE_MIN = 30` and `ESCROW_FEE_RATE = 0.03` in `lib/fees.ts`.
- [x] **Sales:** listing is free. The buyer either **pays in person** (free, no escrow, no dispute support) or **pays with protection** (buyer protection fee ฿10 + 3% of the price, money held until handover + 48 h). Seller receives the full price either way.
- [x] **Deposits:** platform suggests by category; owner adjusts within 30–50% of replacement value, clamped to ฿200–฿3,000. A rental can't be listed without a deposit ≥ ฿200. The owner never holds the deposit.
- [x] **Dispute window:** 48 hours — starts at handover for protected sales and at return for rentals. Auto-release when it closes with no dispute; confirming early releases at once.
- [x] **Owner payout:** rental fee released to the owner 48 hours after handover if no dispute is filed; the deposit stays held until the return.
- [x] **Premium placement:** ฿49 for 7 days, paid by the lister when enabled (simulated charge).
- [x] **Payments approach:** **no payment gateway** (no Omise, no 2C2P, no test mode). Checkout records the chosen method (`promptpay`, `card`, `wallet`) and moves the transaction to its next state; escrow holds, payouts and refunds are state changes in Supabase. The report describes a real launch through a licensed gateway (BusinessRules §7).
- [x] **Report format:** business report structure that mirrors the professor's topic list (see `report_outline.md`).

### Still open
- [ ] **Admin approval for renting items worth more than ~฿6,000** (BusinessRules §3, **open**): how approval works. Build only a placeholder (e.g., flag the listing as "needs approval").
- [ ] **Real-launch gateway (report only):** confirm whether Omise's marketplace payout setup covers the Payment Systems Act licence requirement (BusinessRules §7, **open**). Nothing is built.
- [ ] **Scope freeze:** agree on the P0/P1/P2 list below. Anything not P0/P1 goes into the report as "Future Work".
- [ ] **Confirm with the professor:** how the app is submitted (live URL? repo access? demo video?), any page limit, whether a final demo/presentation is expected, and the policy on AI-assisted writing/disclosure.

### Fee reference (use identically in app, report, README, slides — copied from BusinessRules.md §2)

All amounts in THB; every computed fee is rounded to the nearest baht.

| Fee | Who pays | Amount | When | Refundable? |
|---|---|---|---|---|
| Rental commission | Renter | 10% of the rental fee | At booking | No |
| Escrow handling fee | Renter | `max(30, 3% of deposit)` | At booking | No |
| Deposit | Renter | Suggested by category; 30–50% of replacement value, ฿200–฿3,000 | At booking | Yes, subject to late fees / dispute outcome |
| Buyer protection fee (sales) | Buyer, only if they choose "Pay with protection" | `10 + 3% of sale price` | At checkout | No |
| Premium placement | Lister | ฿49 for 7 days | When enabled | No |
| Listing | — | Free | — | — |
| Sale paid in person | — | Free, no protection | — | — |

Worked examples (THB, before gateway costs, which only exist in a real launch):
- **Rental (mini fridge):** fee 250, deposit 800 → commission 25 + escrow fee max(30, 24) = 30 → renter pays 250 + 25 + 30 + 800 = **1,105** → owner receives 250 (48 h after handover) → renter gets 800 back on a good return → platform keeps **55**.
- **Rental with a larger deposit:** fee 500, deposit 2,000 → commission 50 + escrow fee max(30, 60) = 60 → renter pays **2,610** → platform keeps **110**.
- **Sale, in person:** price 1,000 → buyer pays **1,000** directly to the seller → platform keeps 0.
- **Sale, with protection:** price 1,000 → protection fee 10 + 30 = 40 → buyer pays **1,040** → seller receives 1,000 after handover + 48 h → platform keeps **40**.
- **Late return:** mini fridge rented at ฿250 per month (30 days) → late fee ceil(250 / 30) = **฿9 per day** from the deposit; 3 days late → 27 to the owner, 773 refunded. More than 7 days late → missing → full 800 to the owner.

---

## 1. Timeline

| Dates | Focus | Exit criteria |
|---|---|---|
| **Oct 20 – Oct 26** | Decisions, Supabase schema, auth, first Vercel deploy; report skeleton; **fee/deposit rules aligned with BusinessRules.md** | Users can sign up with an `@ait.asia` email on the live URL; schema + RLS written; `lib/fees.ts` matches BusinessRules §2–6 |
| **Oct 27 – Nov 2** | Replace mock data with DB; listings CRUD + photo storage; dashboards; booking request/approve | Create/edit/browse real listings end-to-end; report sections reused from proposal are drafted |
| **Nov 3 – Nov 9** | Checkout, simulated escrow lifecycle, auto-release, late/missing states, disputes, real-time chat; financial model + tech sections | Full buy (in person and protected) and rent flow works with simulated payments for both parties |
| **Nov 10 – Nov 12** | P1 pages, polish, seed data. **Feature freeze Thu Nov 12** | Everything P0 works; P1 done or cut |
| **Nov 13 – Nov 16** | Testing, bug fixes only, screenshots, report finalisation, peer review | Report complete draft; no known P0 bugs |
| **Nov 17 – Nov 18** | Buffer: proofreading, submission checklist, re-verify live URL | Everything uploaded/ready |
| **Nov 19** | Submit | — |

---

## 2. Website / App

Current status (updated 24 October 2026): Next.js App Router + Tailwind + shadcn/ui with Supabase Auth, Postgres reads/writes, RLS, relational seed data, and session-refresh middleware connected. The app still keeps `lib/data.ts` as an initial loading fallback. Payments are simulated by design (no gateway), Supabase Storage and Realtime are not connected, and the escrow/transaction ledger is not persisted yet. Branch `fix/business-rules-alignment` brings the fee, deposit, sale-checkout and late-return logic in line with BusinessRules.md.

### Completed since the original audit
- [x] Supabase project URL and publishable key configured locally in `.env.local`.
- [x] Supabase browser, server, and middleware clients added with environment validation.
- [x] Auth session refresh middleware added.
- [x] Email/password login and signup connected to Supabase Auth; signup/login UI still validates the AIT email domain client-side.
- [x] Onboarding profile upsert connected to `public.users`.
- [x] Marketplace store loads listings, needs, rentals, threads, participants, messages, listing history, reviews, and favorites from Supabase.
- [x] Listing creation, needs creation, messaging, rentals, listing status changes, listing deletion/editing, and favorites write to Supabase.
- [x] Seed utility updated to generate valid UUID-shaped text IDs and use the currently authenticated Supabase user for foreign-key owners, renters, and senders.
- [x] Seed utility now reports the exact operation and Supabase error code/details when a seed operation fails.
- [x] Database schema was verified: relationship ID columns currently use `text`, so RLS policies compare `auth.uid()::text` to those columns.
- [x] Money logic in `lib/fees.ts` aligned with BusinessRules.md: `escrowHandlingFee` = max(฿30, 3%), `computeSaleQuote` (in person / protected), deposit suggestions by category + ฿200–฿3,000 validation + 30–50% range helper, `DISPUTE_WINDOW_HOURS = 48`, `OWNER_PAYOUT_DELAY_HOURS = 48`, `dailyLateFee`, `returnStatus` (overdue / missing), `settleDeposit` capped at the deposit; covered by unit tests in `lib/fees.test.ts` (done on branch fix/business-rules-alignment).
- [x] `RentalPhase` in `lib/types.ts` extended with every rule state: requested, approved, paid, active, return-pending, released, disputed, resolved, overdue, missing (done on branch fix/business-rules-alignment).

### Known integration notes
- [ ] Apply and verify the final RLS policies for all marketplace tables. The `listings` insert/update policies must compare `seller_id` with `(select auth.uid())::text`.
- [ ] Seed data requires an authenticated Supabase user because `public.users.id` references the logged-in Auth identity.
- [ ] The existing `lib/data.ts` records use mock IDs for UI fallback only; seeded database records use generated IDs and are mapped at seed time.
- [ ] Seed data: every rental listing must have a deposit within ฿200–฿3,000 (re-check old seed rows after the deposit validation change).

### 2.1 Backend foundation `[P0]` — Workstream A
- [x] Create Supabase project and configure local publishable environment variables.
- [x] Create the current marketplace schema: `users`, `listings`, `listing_history`, `reviews`, `needs`, `threads`, `thread_participants`, `messages`, `rentals`, and `favorites`.
- [ ] Add production-grade schema for `listing_photos`, `transactions`, `escrow_ledger`, `rental_details`, `disputes`, and `notifications`.
- [ ] Persist the new rental phases in the database (`rentals.phase` must accept all ten `RentalPhase` values) plus the timestamps the rules need: `requested_at`, `approved_at`, `paid_at`, `handover_at`, `due_at`, `returned_at`, `payout_at`, `dispute_window_ends_at`.
- [ ] Row Level Security on every table (current policies are being verified and still need a second-account security test).
- [ ] **Compute every fee server-side** (never trust client-submitted totals): rental commission, escrow handling fee, buyer protection fee, premium placement, late fees and deposit settlement — reuse the functions in `lib/fees.ts` from a server action or database function.
- [ ] Migrate `lib/types.ts` to match the schema; generate Supabase TypeScript types.
- [x] Replace the core `lib/store.tsx` actions with Supabase queries for listings, needs, rentals, threads/messages, statuses, and favorites.
- [x] Add a browser seed utility for listings across categories, needs, sample history/reviews, threads/messages, and rentals.
- [ ] Move seeding to a server-side/admin-only script and add demo buyer, seller, renter, owner, and admin accounts without exposing service credentials.

### 2.2 Auth & onboarding `[P0]` — Workstream A
- [x] `/signup` and `/login` use Supabase Auth with email/password.
- [ ] Add a dedicated `/verify-email` flow and production email-confirmation UX.
- [ ] Enforce `@ait.asia` **server-side** (currently validated in the UI only).
- [x] Auth session refresh middleware and auth-aware route guard added.
- [ ] Remove the last mock fallback identity (`CURRENT_USER_ID = 'u_me'`) from unauthenticated/loading fallback code; authenticated database actions use the session user.
- [ ] Expand `/onboarding` with dorm/pickup location, role intent, and arrival/departure date.
- [x] Auth-aware nav supports login/logout and reflects authenticated state.

### 2.3 Listings & discovery
- [x] `[P0]` Listings CRUD actions persist to the database; photo upload to Supabase Storage and image validation remain.
- [x] `[P0]` Deposit rules on the sell and edit forms: deposit pre-filled with the category suggestion (kitchen 300, textbooks 200, sports 300, furniture 500, electronics 800, bicycles 1,000, other 300), limited to ฿200–฿3,000, no rental without a deposit (done on branch fix/business-rules-alignment).
- [x] `[P1]` Optional replacement-value field on the sell and edit forms for rentals; when filled, the deposit must sit within 30–50% of it (`depositRangeForValue`) (done on branch fix/business-rules-alignment). The value is a form helper only and is not saved (no column yet).
- [ ] `[P1]` Placeholder for **admin approval of rentals worth more than ~฿6,000** (`needsRentalApproval`): the sell and edit forms already show a "needs admin approval" note; still to do: flag the listing itself. How approval works is **(open)** — don't build more.
- [ ] `[P1]` Premium placement: sell and edit forms now both say the lister pays ฿49 for 7 days **when enabled** (simulated), per BusinessRules §2 (done on branch fix/business-rules-alignment); still to do: store the 7-day expiry.
- [ ] `[P0]` `/dashboard/listings`: tabs for active / sold / rented / draft; edit, pause, delete, mark status.
- [ ] `[P0]` `/dashboard/listings/[id]/edit`.
- [ ] `[P0]` Browse/search/filter/sort running as DB queries (index on category, type, status, created_at; text search).
- [ ] `[P0]` `/dashboard/listings/[id]/requests` — owner sees and approves/rejects rental booking requests. BusinessRules §4 booking flow is **request → owner approves → renter pays `totalDueNow` → handover**, so the renter can only pay after approval (`requested → approved → paid`). Raised from `[P1]` because it is part of the required flow.
- [ ] `[P1]` Route naming alignment: `/browse`→`/marketplace`, `/sell`→`/sell/new`, `/chat`→`/messages` (or update the README/report to the actual routes — pick one and be consistent).
- [ ] `[P2]` `/marketplace/[category]` and `/search?q=` as dedicated routes (current query-param approach is fine).

### 2.4 Transactions, escrow & payments `[P0]` — Workstream A (+B for UI)
All payments, holds, payouts and refunds are **simulated state changes** (BusinessRules §7). No gateway, no webhook, no test mode.
- [x] Sale checkout offers **Pay in person** (free, no escrow, seller marks it sold) or **Pay with protection** (price + ฿10 + 3%, held in escrow) (done on branch fix/business-rules-alignment).
- [x] Checkout shows the payment methods `promptpay` (default), `card` and `wallet`, with a "Payments are simulated — no real money moves" disclaimer (done on branch fix/business-rules-alignment).
- [ ] Full-page `/listing/[id]/checkout` for **both sale and rent** (rent = fee + 10% commission + escrow fee + deposit; protected sale = price + buyer protection fee), with a line-by-line breakdown read from `lib/fees.ts`. Remove the dialog-only approach.
- [ ] Rental **state machine** persisted per BusinessRules §4, with timestamps:
  `requested → approved → paid (deposit held) → active → return-pending → released`,
  `return-pending → disputed → resolved` (admin splits the deposit),
  `active → overdue → missing` (more than 7 days late, deposit to owner).
- [ ] Protected-sale states: paid (held) → handover → 48 h window → released to seller | disputed → resolved. In-person sales skip escrow entirely.
- [ ] `/transaction/[id]` status page for both parties: current state, amounts, 48-hour window countdown, payout time, pickup details.
- [ ] `/transaction/[id]/confirm`: confirm receipt (protected sale) or return condition with photos compared against the handover photos (rental) → early release.
- [ ] **Auto-release job** (pg_cron or scheduled Edge Function): release funds when the **48-hour** dispute window expires with no dispute; one mechanism reused for protected sales and rentals.
- [ ] **Owner payout:** release the rental fee to the owner **48 hours after handover** if no dispute is filed (`ownerPayoutAt`); the deposit stays held until the return. Same scheduled job.
- [ ] **Late returns:** compute `overdue` / `missing` from the due date (7 / 30 / 120 days per period). Daily late fee `ceil(rentalFee / periodDays)` taken from the deposit; more than 7 days late = `missing`, full deposit to the owner. The UI already derives overdue/missing on the rentals page (done on branch fix/business-rules-alignment); persisting the phase and settling the deposit (`lateReturnSettlement`) remain.
- [ ] **Window reminders:** in-app reminders 24 h and 2 h before the 48-hour window closes, and a prominent countdown on `/transaction/[id]`.
- [x] **Fee config in one place** (`lib/fees.ts`): `RENTAL_COMMISSION_RATE = 0.10`, `ESCROW_FEE_MIN = 30`, `ESCROW_FEE_RATE = 0.03`, `BUYER_PROTECTION_BASE_FEE = 10`, `BUYER_PROTECTION_RATE = 0.03`, `PREMIUM_PLACEMENT_FEE = 49`, `DISPUTE_WINDOW_HOURS = 48`, `OWNER_PAYOUT_DELAY_HOURS = 48`, deposit limits and category suggestions (done on branch fix/business-rules-alignment). The server-side calculation and ledger must read from the same file (see 2.1).
- [ ] Deposit settlement: full refund to the renter on a good return; otherwise late fee or dispute outcome via `settleDeposit`. The owner can **never** receive more than the deposit.
- [ ] Seller/owner payout representation (wallet balance + "payout" record; simulated — document this in the report).
- [ ] Refunds on dispute resolution (deposits may land in the in-app `wallet` first).

### 2.5 Disputes & admin
- [ ] `[P0]` `/dispute/[id]`: file within the 48-hour window with description + photo evidence, status tracking, both parties can comment.
- [ ] `[P0]` Minimal `/admin/disputes`: queue, view chat history and before/after photos, resolve with the BusinessRules §6 outcomes (triggers the ledger state change):

  | Finding | Outcome |
  |---|---|
  | Normal wear | ฿0 to the owner, full deposit refunded |
  | Repairable damage | Repair cost to the owner, the rest refunded |
  | Lost or destroyed | Full deposit to the owner |
  | Sale item not as described | Full or partial refund to the buyer |

  The owner's share is capped at the deposit (`settleDeposit`).
- [ ] `[P1]` `/admin/listings` moderation (hide/remove) and `/admin/dashboard` with a few counters.
- [ ] `[P2]` `/admin/users`.

### 2.6 Chat, ratings, history
- [ ] `[P0]` Real-time chat with Supabase Realtime, one thread per listing per user pair; remove the simulated auto-reply; unread counts. Current messages and thread participants persist through Supabase but are not realtime.
- [ ] `[P0]` Persist reviews/ratings; current seed reviews load from Supabase, but review eligibility and profile average updates are not enforced.
- [x] `[P0]` Persist **item history** records and load them from Supabase; ownership transitions still need to append history automatically.

### 2.7 Pre-arrival matching & seasonal features
- [x] `[P0]` Persist needs and load them from Supabase.
- [ ] `[P0]` Run matching server-side against live listings (category + date window + type); show matches on `/needs`.
- [ ] `[P1]` Notify the incoming student when a new matching listing is posted.
- [ ] `[P0]` Keep seasonal banner (`lib/seasons.ts`); **verify the semester dates against AIT's official academic calendar** and cite it.
- [ ] `[P2]` Dedicated `/matches` page.

### 2.8 Profiles, wallet, notifications
- [ ] `[P1]` `/profile/[userId]` public profile: ratings, verification badge, active listings.
- [ ] `[P1]` `/dashboard/orders` (purchase + sales history) and `/dashboard/rentals` with **owner view** as well as renter view.
- [ ] `[P1]` `/dashboard/wallet`: held vs. available balance, refunded deposits, payouts, ledger history (all simulated).
- [ ] `[P1]` `/notifications` (in-app only): chat, match, booking request/approval, window expiring, overdue return, dispute updates.
- [ ] `[P2]` `/dashboard/settings`, `/dashboard/profile`, `/dashboard/reviews`, email notifications.

### 2.9 Public pages & compliance
- [ ] `[P1]` `/how-it-works` page (also useful as a report screenshot) — show the fee table from Section 0 exactly.
- [ ] `[P1]` Simple Terms of Use + Privacy Policy pages (mention data collected, retention, escrow/dispute rules: 48-hour window, late fees, missing after 7 days, owner never receives more than the deposit; check Thailand's PDPA basics).
- [ ] `[P1]` Footer with About/Contact/Terms/Privacy.

### 2.10 Quality, security, deployment `[P0]`
- [ ] Loading, empty, and error states on every page; form validation with clear messages.
- [ ] Responsive pass at phone/tablet/desktop widths (students will open it on phones).
- [ ] Accessibility basics: labels, alt text, contrast, keyboard nav on core flows.
- [ ] Security checklist: RLS policies have been added for the current text-based ID schema, but still need verification with a second account; no service-role key is in the client.
- [ ] Deploy to Vercel from `main` with production env vars; confirm the **public live URL** works logged out and logged in.
- [ ] Demo accounts + README with run instructions and test credentials (keep credentials out of the public repo; the local `.env.local` currently contains a test password and should not be committed).
- [ ] Lighthouse run (performance/accessibility) and record scores for the report.

### 2.11 Testing & user evidence — Workstream B
- [x] Unit tests for every fee formula and the worked examples above (`npm test`, `lib/fees.test.ts`) (done on branch fix/business-rules-alignment).
- [ ] Write 4 end-to-end test scripts, one per flow (seller, buyer, owner, renter), including in-person vs. protected sale, the booking approval step, the dispute path, the late/missing path, and the auto-release path; run them on the deployed app and log results.
- [ ] Test the auto-release and owner-payout job by shortening the 48-hour window in a test environment.
- [ ] Bug bash: each member tries to break the app (wrong inputs, deposits outside ฿200–฿3,000, two browsers, expired sessions).
- [ ] Small usability test with 5–10 AIT students (task list + short survey, e.g., SUS score and "would you use this instead of Facebook/LINE groups?"). Results become evidence in the report.
- [ ] Capture clean screenshots for the report (see Section 3.3).

---

## 3. Final Project Report — Workstream C

> Structure, page budgets, and the fee tables/examples to paste into the report are in **`report_outline.md`** (aligned with BusinessRules.md on 24 Oct 2026).

Required sections come from the brief; status refers to what already exists in the submitted proposal / progress presentation.

### 3.1 Required sections

| # | Section | Status | What to do |
|---|---|---|---|
| 1 | **Background** | Drafted (proposal) | Reuse; add 2–3 sourced facts (AIT international student numbers, intake cycle) — cite AIT sources, not guesses. |
| 2 | **Purpose** | Drafted | Reuse the 4 goals; tie each goal to a measurable indicator (e.g., items diverted from waste, cost saved per student). |
| 3 | **Products / services** | Drafted | Update to the *implemented* feature set; mark what is live vs. planned. |
| 4 | **E-business strategy** | Partial (bullets) | Expand: niche focus, differentiation, network effects, **launch plan** (pilot semester, AIT housing/student union partnership, orientation-week outreach), marketing channels, KPIs. |
| 5 | **E-business model & revenue model** | Drafted in [docs/Proposal.md](docs/Proposal.md); check against BusinessRules §2 | "Monetize trust, not access": free listing; 10% rental commission; escrow handling fee `max(฿30, 3% of deposit)`; optional buyer protection fee ฿10 + 3% on sales; premium placement ฿49 / 7 days. Add the worked examples (mini fridge ฿1,105; ฿1,000 sale = ฿1,000 in person or ฿1,040 with protection). Add a C2B2C diagram. |
| 6 | **Target customers/users** | Partial | Add personas for outgoing and incoming students, segment size with a sourced estimate, needs/pain points, adoption barriers. |
| 7 | **Existing/potential competitors** | Drafted (table) | Add a feature-comparison matrix (verification, rental support, escrow, calendar matching, search/filter, fees) and a short positioning statement. |
| 8 | **Investment required** | **Not started** | One-off vs. recurring costs, with assumptions (see 3.2). |
| 9 | **Projected revenues & expenses** | **Not started** | 3-year projection by semester, starting from BusinessRules §10 planning numbers; 3 scenarios (75 / 150 / 300 rentals per semester), break-even (see 3.2). |
| 10 | **Technical infrastructure** | **Not started** | Architecture diagram, stack and why, data model/ERD, security, scalability, CI/CD, environments, monitoring. |
| 11 | **Human resources needed** | **Not started** | Team roles during build; post-launch roles (maintainer, community moderator/dispute handler, campus ambassadors); hours/cost estimate. |
| 12 | **Payment methods & delivery** | **Not started** | Methods `promptpay` (default), `card` (international students without a Thai account), `wallet`; fee display; escrow flow; 48-hour dispute window; owner payout 48 h after handover; refunds; late fees. State that the course build simulates payments, then describe the real launch (licensed gateway holds funds, Omise fees, Payment Systems Act — BusinessRules §7). Delivery = campus pickup/handover points, no shipping. |
| 13 | **Detailed website implementation** | **Not started** | Page-by-page walkthrough with screenshots, key flows, DB schema, core algorithms, testing results, live URL (see 3.3). |

### 3.2 Finance section (Investment, Revenue, Expenses)
- [ ] Source a defensible market-size input: AIT international student headcount and typical intake/outtake sizes (AIT registrar/website/official reports). Cite it. BusinessRules §10 uses ~2,500 full-time students — find the source.
- [ ] List explicit **assumptions** in a table, starting from BusinessRules §10: ~30% active per semester, 1 in 5 of those rents once → ~150 rentals per semester (low 75, high 300); average rental ฿300 with a ฿700 deposit; payment mix 70% PromptPay / 30% card; plus share of sales paid with protection, average sale price, premium uptake.
- [ ] Revenue per rental: commission + escrow fee (฿30 + ฿30 = ฿60 in the §10 case). Revenue per protected sale: ฿10 + 3% of price. Premium: ฿49 per 7-day placement.
- [ ] Model gateway processing fees as a **real-launch expense** paid by the platform out of the commission and escrow fee (Omise: cards 3.65%, PromptPay 1.65%, both + 7% VAT, charged on the whole payment including the deposit and not returned when the deposit is refunded) → ~฿26 per rental, ~฿34 net. State a VAT/tax assumption explicitly. The course build has no gateway costs.
- [ ] Reconcile the §10 headline: 150 rentals × ฿34 = ฿5,100, but §10 quotes ~฿7,000 net revenue per semester — show where the remaining ~฿1,900 comes from (protected sales, premium placement) or correct the figure **in BusinessRules.md first** after agreeing it with the team.
- [ ] Sensitivity tables: escrow fee floor/rate (e.g., ฿20 / ฿30 / ฿40 floor and 2% / 3% / 4% rate), rental commission (8% / 10% / 12%), payment mix (more card vs. PromptPay), and adoption (75 / 150 / 300 rentals). Present these as "what if" analysis, not as the chosen rates — the chosen rates are fixed in BusinessRules §2.
- [ ] Build the model in a spreadsheet; include the file as an appendix or paste the key tables into the report.
- [ ] **Investment required:** development effort (valued at an assumed rate), design, domain, legal/policy drafting, launch marketing, contingency.
- [ ] **Recurring expenses:** hosting (Vercel), database/storage (Supabase), payment gateway fees (real launch), email/SMS provider, moderation/dispute handling time, maintenance. Look up *current* published pricing for each and cite the pricing page + access date.
- [ ] Two cost cases from §10: **lean pilot** (~฿5,700 per semester, student-run or AIT-supported) vs. **with paid staff** (~฿23,000 per semester, needs ~600 rentals).
- [ ] Three scenarios (conservative / base / optimistic) by semester, reflecting AIT's seasonal intake/outtake peaks.
- [ ] Break-even point, unit economics per transaction, and a sensitivity check (e.g., what if adoption is half of base case).
- [ ] State clearly that figures are estimates and list the main risks to them.

### 3.3 Implementation chapter (evidence)
- [ ] Architecture diagram (Next.js on Vercel ↔ Supabase Auth/Postgres/Storage/Realtime/scheduled jobs). Payments are a simulated module inside the app; draw the licensed gateway only as a dashed "real launch" box.
- [ ] ERD of the final schema.
- [ ] Final **page map** and the **four user-flow diagrams** (the flows are redrawn and follow the rules: `figures/*_userflow.png`, sources in [figures/src/](figures/src/); re-render if the rules change; see Section 4).
- [ ] Screenshots, in flow order: landing → signup/verify → browse → listing detail → booking request/approval → checkout (in-person sale, protected sale, rental) → transaction/escrow status → confirm → dispute → chat → needs/matches → dashboards → admin dispute queue.
- [ ] Explain the key mechanisms: fee calculation (`lib/fees.ts`), deposit suggestion/limits, rental state machine, auto-release and owner payout job, late fee / missing rule, matching logic, seasonal detection.
- [ ] **Implemented vs. planned table** — be transparent that payments, escrow holds, payouts and refunds are simulated (no gateway by scope decision), and what is future work.
- [ ] Challenges and design decisions (e.g., why escrow is a state machine/ledger independent of any gateway, why the escrow fee scales with the deposit).
- [ ] Testing summary: test scenarios, results, usability study findings, Lighthouse scores.
- [ ] Live URL, repository link (if allowed), demo credentials.

### 3.4 Additional sections that strengthen the report ("Etc.")
- [ ] **Literature review** — carry over from the proposal and make citations consistent (e.g., use "Li & Wang (2020)" rather than "the Sustainability (2020) study"); connect each paper to a concrete design decision in the final build.
- [ ] **SWOT** and a short **risk register** (low adoption/cold start, disputes, fraud, payment regulation, data privacy, key-person dependency).
- [ ] **Legal, ethical & regulatory notes:** Thailand's Payment Systems Act treats receiving payment on behalf of sellers as a licensed service — explain that the prototype simulates all money movement in-app (no gateway) and that a real launch would have the licensed gateway or partner hold funds and pay out on the platform's instruction, never the team's own bank account (BusinessRules §7; Omise marketplace payouts still **open**); PDPA/privacy considerations; prohibited items policy; university approval for using the AIT name/email domain.
- [ ] **Sustainability impact** (circular economy angle): how you'd measure items reused and waste avoided.
- [ ] **Limitations and future work** — the P2 list goes here, plus admin approval for high-value rentals (open) and real gateway integration.
- [ ] **Conclusion.**
- [ ] **References** — verify every DOI resolves and every author/page/volume detail matches the DOI landing page; keep one citation style throughout.
- [ ] **Appendices:** diagrams, schema, test scripts/results, survey instrument and results, financial spreadsheet, README.

### 3.5 Report mechanics
- [ ] Cover page (course, title, all three names + AIT emails, primary contact marked, date).
- [ ] Table of contents, numbered headings, captioned figures/tables referenced in the text.
- [ ] Writing split by workstream, then **one person does a full consistency edit** (terminology, revenue numbers, route names, tense).
- [ ] Cross-check numbers: every figure in text, tables, slides, and README must match BusinessRules.md and the final model.
- [ ] Proofread pass by someone who didn't write the section; check against the course policy on AI-assisted writing and disclose if required.
- [ ] Export to PDF and check the layout on another computer.

---

## 4. Consistency fixes across existing material

- [ ] Revenue language everywhere (proposal text, progress deck revenue slide, README, report) must match BusinessRules §1–2: listing is **free**, the 10% commission is on **rentals only**, plus the escrow handling fee `max(฿30, 3% of deposit)`, the optional buyer protection fee (฿10 + 3%) on sales, and premium placement ฿49 / 7 days. ([docs/Proposal.md](docs/Proposal.md) already matches; check the deck.)
- [x] Update the user-flow figures: `figures/renter_userflow.png` (and the owner/buyer/seller PNGs) still say "Return dispute window opens (24-48 hrs)" and "Pay rental fee + deposit online" — regenerate them from the Mermaid diagrams in [docs/Mapping&UF.md](docs/Mapping&UF.md) so they say **48 hours**, show commission + escrow fee `max(฿30, 3%)` + deposit, the owner payout 48 h after handover, the late/missing path, and the dispute outcomes (not "deposit forfeited to owner"). *Done 24 Oct 2026: all four redrawn from Mermaid sources in [figures/src/](figures/src/) (also copied into Mapping&UF.md); no sales commission, in-person vs. protected sale, simulated payments, 48-hour windows, late fee / missing, dispute outcomes. Re-render steps in [figures/README.md](figures/README.md).*
- [x] Update `figures/usecase_diagram.svg` / `.png`: "optional, within 24-48 h" → "within 48 h"; the "Payment gateway (Omise / 2C2P)" actor should be relabelled as simulated payments in the course build (gateway = real launch only). *Done 24 Oct 2026: gateway tag is now "Simulated payment (in-app)", windows are 48 h, and "Receive payout" and "Settle late returns" use cases were added.*
- [x] README fee wording: "the flat escrow handling fee" → `max(฿30, 3% of the deposit)`, and sales paid in person or with protection (fixed 24 Oct 2026).
- [ ] If any progress-deck slides are reused: fix the duplicate "07." in the contents slide and the "Comission" typo on the revenue slide, and check the fee numbers on the revenue slide against BusinessRules §2.
- [ ] Reconcile route names between README, audit, and the real app.
- [ ] Update `audit.md` (it still lists "Payments: Omise / 2C2P — not connected" and "10% commission, deposit logic") so it reflects the no-gateway decision and the new fee logic.
- [ ] Update the README feature list so it matches what is actually implemented at submission time (it still describes an in-memory prototype with no database).

---

## 5. Submission checklist (Nov 17 – 19)

- [ ] Live Vercel URL loads in an incognito window on desktop and phone; demo accounts work; seed data present.
- [ ] No console errors on core flows; no leftover mock data or hardcoded user IDs.
- [ ] Production env vars set; no secrets committed to the repo.
- [ ] Every fee shown in the app, report, README and slides matches BusinessRules.md §2 (spot-check the mini fridge ฿1,105 and the ฿1,040 protected sale).
- [ ] Report PDF final, filename and cover page correct, all team names and emails present.
- [ ] Links in the report (live URL, repo, DOIs) tested.
- [ ] README current; repo access granted to the instructor if required.
- [ ] One team member designated to submit; a second verifies the upload.
- [ ] Keep a backup copy of everything (report, spreadsheet, screenshots, database export).

---

## 6. Risks to watch

| Risk | Mitigation |
|---|---|
| Not enough time to build every page | Hold the P0/P1/P2 line; cut early rather than late |
| Reviewer mistakes simulated payments for missing work | In-app "payments simulated" disclaimer; explain the scope decision (Timeline.md) and the real-launch design (BusinessRules §7) in the report |
| Fee or rule drift between app, report and slides | BusinessRules.md is the single source; fee logic only in `lib/fees.ts` with unit tests; one consistency editor |
| Scope creep in admin/notifications | Admin = disputes + moderation only; high-value rental approval stays a placeholder (open) |
| Report written last | Draft reused sections in week 1; finance and tech sections in week 3 |
| Numbers inconsistent across documents | Single source of truth (BusinessRules.md for rules, the financial model for projections); one consistency editor |
| Last-minute deploy surprises | Deploy in week 1 and redeploy continuously |
