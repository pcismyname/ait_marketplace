# AIT Circular Marketplace — Final Project Action Items

**Course:** AST02.21 — E-Business Development and Technology
**Final due:** Thursday, 19 November 2026
**Deliverables:** (1) working website/app, (2) final project report
**Plan written:** 20 October 2026 (30 days left)

Legend: `[P0]` must ship · `[P1]` should ship if time allows · `[P2]` cut to "Future Work" in the report unless we're ahead of schedule.
Suggested workstreams so everyone has a lane (assign names in the table below):

| Workstream | Scope | Owner |
|---|---|---|
| **A — Backend & payments** | Supabase schema/RLS, auth, escrow logic, payment sandbox, deploy | ______ |
| **B — Frontend, UX & QA** | Remaining pages, polish, responsive checks, testing, screenshots | ______ |
| **C — Report, research & finance** | Report writing, financial model, diagrams, references | ______ |

Everyone cross-reviews one other workstream's output each week.

---

## 0. Decisions

### Locked
- [x] **Commission:** 10% of the listing price on every transaction (sale or rental), added on top and paid by the buyer/renter. Seller/owner receives the full listing price.
- [x] **Deposit-handling fee (rentals only):** 4% of the deposit amount, paid by the renter at checkout, **non-refundable** (it pays for holding the deposit and running disputes). Keep the rate in one config constant so it can be tuned (3% / 4% / 5% sensitivity goes in the report).
- [x] **Dispute window:** 24 hours — starts at handover for sales and at return for rentals.
- [x] **Payments approach:** gateway in test/sandbox mode + escrow tracked as a ledger in Supabase (see Section 2.4).
- [x] **Report format:** business report structure that mirrors the professor's topic list (see `report_outline.md`).

### Still open
- [ ] **Gateway choice:** Omise or 2C2P — whichever gives sandbox access fastest. **Before finalising the 4% rate, check the gateway's fee schedule and whether processing fees are returned when a deposit is refunded.** If fees are returned on refunds, drop the deposit fee to 3%.
- [ ] **Premium placement:** recommend treating it as a planned feature — keep the toggle in the sell form, label it clearly, and state in the report that it is not billed in the prototype.
- [ ] **Scope freeze:** agree on the P0/P1/P2 list below. Anything not P0/P1 goes into the report as "Future Work".
- [ ] **Confirm with the professor:** how the app is submitted (live URL? repo access? demo video?), any page limit, whether a final demo/presentation is expected, and the policy on AI-assisted writing/disclosure.

### Fee reference (use identically in app, report, README, slides)

| Item | Rate | Paid by | Refundable? |
|---|---|---|---|
| Platform commission | 10% of listing price (sale price or rental fee) | Buyer / renter, on top | No |
| Deposit-handling fee | 4% of deposit (rentals only) | Renter | No |
| Deposit | Set by owner | Renter | Yes, subject to dispute outcome |

Worked examples (THB, illustrative):
- **Sale:** list at 100 → buyer pays 110 → seller receives 100 → platform keeps 10 (before gateway costs).
- **Rental:** fee 200, deposit 1,000 → renter pays 200 + 20 (commission) + 1,000 + 40 (deposit fee) = 1,260 → owner receives 200 → renter gets 1,000 back if no dispute → platform keeps 60 (before gateway costs).

---

## 1. Timeline

| Dates | Focus | Exit criteria |
|---|---|---|
| **Oct 20 – Oct 26** | Decisions, Supabase schema, auth, first Vercel deploy; report skeleton | Users can sign up with an `@ait.asia` email on the live URL; schema + RLS written |
| **Oct 27 – Nov 2** | Replace mock data with DB; listings CRUD + photo storage; dashboards | Create/edit/browse real listings end-to-end; report sections reused from proposal are drafted |
| **Nov 3 – Nov 9** | Checkout, escrow lifecycle, auto-release, disputes, real-time chat; financial model + tech sections | Full buy and rent flow works in sandbox for both parties |
| **Nov 10 – Nov 12** | P1 pages, polish, seed data. **Feature freeze Thu Nov 12** | Everything P0 works; P1 done or cut |
| **Nov 13 – Nov 16** | Testing, bug fixes only, screenshots, report finalisation, peer review | Report complete draft; no known P0 bugs |
| **Nov 17 – Nov 18** | Buffer: proofreading, submission checklist, re-verify live URL | Everything uploaded/ready |
| **Nov 19** | Submit | — |

---

## 2. Website / App

Baseline (from the audit): Next.js App Router + Tailwind + shadcn/ui; 7 pages working on **mock in-memory data** (`lib/data.ts`, `lib/store.tsx`); fee logic, seasonal detection, and domain types exist. No auth, no database, no real payments, no real-time chat. Rent checkout is a dialog; **there is no checkout flow for sales yet**.

### 2.1 Backend foundation `[P0]` — Workstream A
- [ ] Create Supabase project (dev + prod, or one project with clear env separation); add keys to Vercel env vars and a local `.env.example`.
- [ ] Design and create schema: `profiles`, `listings`, `listing_photos`, `needs`, `conversations`, `messages`, `transactions` (type: sale/rent, status, amounts, window timestamps), `escrow_ledger` entries, `rental_details`, `disputes`, `reviews`, `item_history` (ownership chain), `notifications`.
- [ ] Row Level Security on every table (users read/write only what they should; admin role for moderation).
- [ ] **Compute prices and commission server-side** (never trust client-submitted totals); reuse the logic in `lib/fees.ts`.
- [ ] Migrate `lib/types.ts` to match the schema; generate Supabase TypeScript types.
- [ ] Replace each `lib/store.tsx` action with real queries/server actions (`addListing`, `addNeed`, `startRental`, `setRentalPhase`, thread/message actions).
- [ ] Seed script: demo users (buyer, seller, renter, owner, admin), ~20 listings across all categories, a couple of needs, sample reviews, one transaction in each state.

### 2.2 Auth & onboarding `[P0]` — Workstream A
- [ ] `/signup`, `/login`, `/verify-email` with Supabase Auth.
- [ ] Enforce `@ait.asia` **server-side** (auth hook or DB trigger plus a server check), not only in the UI.
- [ ] Remove hardcoded `CURRENT_USER_ID = 'u_me'`; use the session user everywhere; protect routes with middleware.
- [ ] `/onboarding`: dorm/pickup location, role intent (outgoing/incoming), arrival or departure date (feeds matching + seasonal banner).
- [ ] Auth-aware nav (login/logout, avatar, unread badge).

### 2.3 Listings & discovery
- [ ] `[P0]` Listings CRUD against the DB; photo upload to Supabase Storage (replace `URL.createObjectURL`); image size/type validation.
- [ ] `[P0]` `/dashboard/listings`: tabs for active / sold / rented / draft; edit, pause, delete, mark status.
- [ ] `[P0]` `/dashboard/listings/[id]/edit`.
- [ ] `[P0]` Browse/search/filter/sort running as DB queries (index on category, type, status, created_at; text search).
- [ ] `[P1]` `/dashboard/listings/[id]/requests` — owner sees and approves/rejects rental booking requests (the rent flow requires owner approval; audit says this is missing).
- [ ] `[P1]` Route naming alignment: `/browse`→`/marketplace`, `/sell`→`/sell/new`, `/chat`→`/messages` (or update the README/report to the actual routes — pick one and be consistent).
- [ ] `[P2]` `/marketplace/[category]` and `/search?q=` as dedicated routes (current query-param approach is fine).

### 2.4 Transactions, escrow & payments `[P0]` — Workstream A (+B for UI)
- [ ] Full-page `/listing/[id]/checkout` for **both sale and rent** (sale = price + 10%; rent = fee + 10% + deposit). Remove the dialog-only approach.
- [ ] Integrate payment gateway in **test/sandbox mode** (cards and PromptPay QR if available). Webhook handler to confirm payment.
- [ ] Escrow as a **ledger state machine**: `paid → held → handover_confirmed → dispute_window_open → released | disputed → resolved_(buyer|seller)` with timestamps.
- [ ] `/transaction/[id]` status page for both parties: current state, amounts, window countdown, pickup details.
- [ ] `/transaction/[id]/confirm`: confirm receipt (sale) or return condition with photos (rent) → early release.
- [ ] **Auto-release job** (pg_cron or scheduled Edge Function): release funds when the **24-hour** dispute window expires with no dispute; one mechanism reused for sales and rentals.
- [ ] **Window reminders:** with only 24 hours to dispute, send in-app reminders (e.g., at 12h and 2h before the window closes) and show a prominent countdown on `/transaction/[id]`.
- [ ] **Fee config in one place** (`lib/fees.ts`): `COMMISSION_RATE = 0.10`, `DEPOSIT_FEE_RATE = 0.04`, `RELEASE_WINDOW_HOURS = 24`; the checkout page, server-side calculation, and ledger all read from it. Show a line-by-line breakdown at checkout (price, commission, deposit, deposit fee, total).
- [ ] Deposit logic for rentals: refund to renter, or partial/full to owner per dispute outcome.
- [ ] Seller/owner payout representation (wallet balance + "payout" record; actual bank payout can be simulated — document this).
- [ ] Refunds on dispute resolution.
- [ ] Decide and document the **sandbox disclaimer** shown in-app (e.g., "Demo mode — no real money moves").

### 2.5 Disputes & admin
- [ ] `[P0]` `/dispute/[id]`: file with description + photo evidence, status tracking, both parties can comment.
- [ ] `[P0]` Minimal `/admin/disputes`: queue, view evidence, resolve for buyer/seller (triggers ledger outcome).
- [ ] `[P1]` `/admin/listings` moderation (hide/remove) and `/admin/dashboard` with a few counters.
- [ ] `[P2]` `/admin/users`.

### 2.6 Chat, ratings, history
- [ ] `[P0]` Real-time chat with Supabase Realtime, one thread per listing per user pair; remove the simulated auto-reply; unread counts.
- [ ] `[P0]` Persist reviews/ratings; update average rating on profiles; only allow a review after a completed transaction.
- [ ] `[P0]` Persist **item history** (ownership chain) so the "3rd owner, still AIT community" view is driven by real data.

### 2.7 Pre-arrival matching & seasonal features
- [ ] `[P0]` Persist needs; run matching server-side against live listings (category + date window + type); show matches on `/needs`.
- [ ] `[P1]` Notify the incoming student when a new matching listing is posted.
- [ ] `[P0]` Keep seasonal banner (`lib/seasons.ts`); **verify the semester dates against AIT's official academic calendar** and cite it.
- [ ] `[P2]` Dedicated `/matches` page.

### 2.8 Profiles, wallet, notifications
- [ ] `[P1]` `/profile/[userId]` public profile: ratings, verification badge, active listings.
- [ ] `[P1]` `/dashboard/orders` (purchase + sales history) and `/dashboard/rentals` with **owner view** as well as renter view.
- [ ] `[P1]` `/dashboard/wallet`: held vs. available balance, ledger history.
- [ ] `[P1]` `/notifications` (in-app only): chat, match, window expiring, dispute updates.
- [ ] `[P2]` `/dashboard/settings`, `/dashboard/profile`, `/dashboard/reviews`, email notifications.

### 2.9 Public pages & compliance
- [ ] `[P1]` `/how-it-works` page (also useful as a report screenshot).
- [ ] `[P1]` Simple Terms of Use + Privacy Policy pages (mention data collected, retention, escrow/dispute rules; check Thailand's PDPA basics).
- [ ] `[P1]` Footer with About/Contact/Terms/Privacy.

### 2.10 Quality, security, deployment `[P0]`
- [ ] Loading, empty, and error states on every page; form validation with clear messages.
- [ ] Responsive pass at phone/tablet/desktop widths (students will open it on phones).
- [ ] Accessibility basics: labels, alt text, contrast, keyboard nav on core flows.
- [ ] Security checklist: RLS verified with a second account, no service-role key in the client, rate-limit auth/chat endpoints if feasible, sanitize user content.
- [ ] Deploy to Vercel from `main` with production env vars; confirm the **public live URL** works logged out and logged in.
- [ ] Demo accounts + README with run instructions, env vars, and test credentials (keep test credentials out of the public repo if it is public).
- [ ] Lighthouse run (performance/accessibility) and record scores for the report.

### 2.11 Testing & user evidence — Workstream B
- [ ] Write 4 end-to-end test scripts, one per flow (seller, buyer, owner, renter), including the dispute path and the auto-release path; run them on the deployed app and log results.
- [ ] Test the auto-release job by shortening the window in a test environment.
- [ ] Bug bash: each member tries to break the app (wrong inputs, two browsers, expired sessions).
- [ ] Small usability test with 5–10 AIT students (task list + short survey, e.g., SUS score and "would you use this instead of Facebook/LINE groups?"). Results become evidence in the report.
- [ ] Capture clean screenshots for the report (see Section 3.3).

---

## 3. Final Project Report — Workstream C

> Structure, page budgets, and the fee tables/examples to paste into the report are in **`report_outline.md`**.

Required sections come from the brief; status refers to what already exists in the submitted proposal / progress presentation.

### 3.1 Required sections

| # | Section | Status | What to do |
|---|---|---|---|
| 1 | **Background** | Drafted (proposal) | Reuse; add 2–3 sourced facts (AIT international student numbers, intake cycle) — cite AIT sources, not guesses. |
| 2 | **Purpose** | Drafted | Reuse the 4 goals; tie each goal to a measurable indicator (e.g., items diverted from waste, cost saved per student). |
| 3 | **Products / services** | Drafted | Update to the *implemented* feature set; mark what is live vs. planned. |
| 4 | **E-business strategy** | Partial (bullets) | Expand: niche focus, differentiation, network effects, **launch plan** (pilot semester, AIT housing/student union partnership, orientation-week outreach), marketing channels, KPIs. |
| 5 | **E-business model & revenue model** | Drafted but **outdated** | Rewrite for the final decision (commission on all transactions, 4% deposit-handling fee on rentals, premium placement status). Add a transaction example (list at 100 → buyer pays 110 → seller gets 100 → platform keeps 10). Add a C2B2C diagram. |
| 6 | **Target customers/users** | Partial | Add personas for outgoing and incoming students, segment size with a sourced estimate, needs/pain points, adoption barriers. |
| 7 | **Existing/potential competitors** | Drafted (table) | Add a feature-comparison matrix (verification, rental support, escrow, calendar matching, search/filter, fees) and a short positioning statement. |
| 8 | **Investment required** | **Not started** | One-off vs. recurring costs, with assumptions (see 3.2). |
| 9 | **Projected revenues & expenses** | **Not started** | 3-year projection, 3 scenarios, break-even (see 3.2). |
| 10 | **Technical infrastructure** | **Not started** | Architecture diagram, stack and why, data model/ERD, security, scalability, CI/CD, environments, monitoring. |
| 11 | **Human resources needed** | **Not started** | Team roles during build; post-launch roles (maintainer, community moderator/dispute handler, campus ambassadors); hours/cost estimate. |
| 12 | **Payment methods & delivery** | **Not started** | Payment methods supported, fee display, escrow flow, payouts, refunds; delivery = campus pickup/handover points; dispute window. |
| 13 | **Detailed website implementation** | **Not started** | Page-by-page walkthrough with screenshots, key flows, DB schema, core algorithms, testing results, live URL (see 3.3). |

### 3.2 Finance section (Investment, Revenue, Expenses)
- [ ] Source a defensible market-size input: AIT international student headcount and typical intake/outtake sizes (AIT registrar/website/official reports). Cite it.
- [ ] List explicit **assumptions** in a table: adoption % by semester, transactions per active user per semester, average item price, sale/rent mix, average rental fee and deposit, commission rate, premium uptake.
- [ ] Model gateway processing fees as an **expense** (they come out of the 10% commission and the deposit-handling fee), and state a VAT/tax assumption explicitly rather than leaving it out.
- [ ] Add a sensitivity table for the deposit-handling fee (3% / 4% / 5%) and for the commission rate.
- [ ] Build the model in a spreadsheet; include the file as an appendix or paste the key tables into the report.
- [ ] **Investment required:** development effort (valued at an assumed rate), design, domain, legal/policy drafting, launch marketing, contingency.
- [ ] **Recurring expenses:** hosting (Vercel), database/storage (Supabase), payment gateway fees, email/SMS provider, moderation/dispute handling time, maintenance. Look up *current* published pricing for each and cite the pricing page + access date.
- [ ] Three scenarios (conservative / base / optimistic) by semester, reflecting AIT's seasonal intake/outtake peaks.
- [ ] Break-even point, unit economics per transaction, and a sensitivity check (e.g., what if adoption is half of base case).
- [ ] State clearly that figures are estimates and list the main risks to them.

### 3.3 Implementation chapter (evidence)
- [ ] Architecture diagram (Next.js on Vercel ↔ Supabase Auth/Postgres/Storage/Realtime/scheduled jobs ↔ payment gateway).
- [ ] ERD of the final schema.
- [ ] Final **page map** and the **four user-flow diagrams** (from the README; update if the flows changed).
- [ ] Screenshots, in flow order: landing → signup/verify → browse → listing detail → checkout (sale and rent) → transaction/escrow status → confirm → dispute → chat → needs/matches → dashboards → admin dispute queue.
- [ ] Explain the key mechanisms: fee calculation, escrow state machine, auto-release job, matching logic, seasonal detection.
- [ ] **Implemented vs. planned table** — be transparent about what is simulated (e.g., sandbox payments, simulated payouts) and what is future work.
- [ ] Challenges and design decisions (e.g., why escrow is a ledger on top of a gateway sandbox).
- [ ] Testing summary: test scenarios, results, usability study findings, Lighthouse scores.
- [ ] Live URL, repository link (if allowed), demo credentials.

### 3.4 Additional sections that strengthen the report ("Etc.")
- [ ] **Literature review** — carry over from the proposal and make citations consistent (e.g., use "Li & Wang (2020)" rather than "the Sustainability (2020) study"); connect each paper to a concrete design decision in the final build.
- [ ] **SWOT** and a short **risk register** (low adoption/cold start, disputes, fraud, payment regulation, data privacy, key-person dependency).
- [ ] **Legal, ethical & regulatory notes:** holding user funds may fall under payment/e-money rules in Thailand — explain that the prototype uses a gateway sandbox and what a compliant production path would look like (licensed gateway/escrow partner); PDPA/privacy considerations; prohibited items policy; university approval for using the AIT name/email domain.
- [ ] **Sustainability impact** (circular economy angle): how you'd measure items reused and waste avoided.
- [ ] **Limitations and future work** — the P2 list goes here.
- [ ] **Conclusion.**
- [ ] **References** — verify every DOI resolves and every author/page/volume detail matches the DOI landing page; keep one citation style throughout.
- [ ] **Appendices:** diagrams, schema, test scripts/results, survey instrument and results, financial spreadsheet, README.

### 3.5 Report mechanics
- [ ] Cover page (course, title, all three names + AIT emails, primary contact marked, date).
- [ ] Table of contents, numbered headings, captioned figures/tables referenced in the text.
- [ ] Writing split by workstream, then **one person does a full consistency edit** (terminology, revenue numbers, route names, tense).
- [ ] Cross-check numbers: every figure in text, tables, slides, and README must match the final model.
- [ ] Proofread pass by someone who didn't write the section; check against the course policy on AI-assisted writing and disclose if required.
- [ ] Export to PDF and check the layout on another computer.

---

## 4. Consistency fixes across existing material

- [ ] Replace "Free sales listing" / "rental commission only" language everywhere (proposal text, progress deck revenue slide, README revenue section) with the final model.
- [ ] Update the README flow diagrams: change "24-48 hrs" to "24 hrs", and in the owner/renter rental flows add the 4% deposit-handling fee (non-refundable) to what the renter pays.
- [ ] If any progress-deck slides are reused: fix the duplicate "07." in the contents slide and the "Comission" typo on the revenue slide.
- [ ] Reconcile route names between README, audit, and the real app.
- [ ] Update the README feature list so it matches what is actually implemented at submission time.

---

## 5. Submission checklist (Nov 17 – 19)

- [ ] Live Vercel URL loads in an incognito window on desktop and phone; demo accounts work; seed data present.
- [ ] No console errors on core flows; no leftover mock data or hardcoded user IDs.
- [ ] Production env vars set; no secrets committed to the repo.
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
| Payment gateway onboarding delays | Start sandbox setup on day 1; keep escrow logic gateway-agnostic |
| Scope creep in admin/notifications | Admin = disputes + moderation only |
| Report written last | Draft reused sections in week 1; finance and tech sections in week 3 |
| Numbers inconsistent across documents | Single source of truth (the financial model); one consistency editor |
| Last-minute deploy surprises | Deploy in week 1 and redeploy continuously |
