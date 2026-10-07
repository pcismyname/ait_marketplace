# PassItOn — Project Timeline

**What gets built and written, and by when, up to the final submission on 19 November 2026.**
Update this file when scope or dates change.

Related: [Proposal.md](Proposal.md) (what and why), [BusinessRules.md](BusinessRules.md) (what the money logic must do), [UserFlows.md](UserFlows.md) (routes that exist today), [Mapping&UF.md](Mapping&UF.md) (planned full app).

---

## Key dates

| Date | Milestone | Status |
|---|---|---|
| Thu 3 Sep 2026 | Proposal | Submitted |
| Thu 8 Oct 2026 | Progress presentation (slides, then a live demo of the website) | This week |
| Thu 19 Nov 2026 | Final submission: website + final report | Due |

## Scope decision: no payment gateway

**We are not integrating a payment gateway** (no Omise, no 2C2P, no test mode). Payments, escrow holds, payouts and refunds are simulated as state changes inside the app, as allowed by the course plan ("a simple state machine is sufficient to demonstrate the mechanism"). The report still describes how a real launch would handle money: see section 7 of [BusinessRules.md](BusinessRules.md).

## Phases

Dates after 8 October are targets; the order matters more than the exact day.

| Phase | Dates | Status |
|---|---|---|
| 1. Foundation & scoping | to mid-Sep | Done |
| 2. Core build | mid-Sep – 7 Oct | Done |
| Progress presentation | 8 Oct | This week |
| 3. Feature completion | 9 Oct – 30 Oct | Next |
| 4. Polish & technical write-up | 2 Nov – 13 Nov | Planned |
| 5. Finalization | 16 Nov – 19 Nov | Planned |

### Phase 1 — Foundation & scoping (done)
- Tech stack: Next.js (App Router) on Vercel; Supabase planned.
- MVP feature list, page mapping and user flows ([Mapping&UF.md](Mapping&UF.md)).
- Data model in `lib/types.ts`.

### Phase 2 — Core build (done)
- Home, browse and filters, listing detail (fees, item history, ratings).
- Sell / rent form with premium placement; My listings dashboard.
- Chat, pre-arrival needs, My rentals with escrow status.
- Rental checkout dialog with payment method choice (simulated).
- Campus shop listings, brand and logo, seed demo data.
- Business rules written down and agreed ([BusinessRules.md](BusinessRules.md)).

### Phase 3 — Feature completion (9 – 30 Oct)
Start by applying the instructor's feedback from 8 October.

**Build**
- [ ] Supabase: database for users, listings, rentals, messages; AIT email login (`@ait.asia` only).
- [ ] Fees per BusinessRules.md: escrow fee `max(฿30, 3% of deposit)` in `lib/fees.ts`.
- [ ] Deposit rules on the sell form: category suggestion, ฿200 – ฿3,000 limits, no rental without a deposit.
- [ ] Sales checkout: *Pay in person* (free) or *Pay with protection* (฿10 + 3%), simulated.
- [ ] Escrow state machine (simulated): requested → approved → paid → active → return-pending → released / disputed, plus owner payout 48 h after handover.
- [ ] Ratings after a completed exchange.

**Write (report sections, drafted in parallel)**
- [ ] Investment required
- [ ] Projected revenues and expenses (use the planning numbers in BusinessRules.md section 10)
- [ ] Human resources needed
- [ ] Payment methods and delivery (real-launch design, noting the course build is simulated)

### Phase 4 — Polish & technical write-up (2 – 13 Nov)

**Build**
- [ ] Late, overdue and missing rental states (daily late fee, 7 days = missing).
- [ ] Simple admin dispute page (normal wear / repairable damage / lost outcomes).
- [ ] Basic calendar-aware matching: same category + needed-by date.
- [ ] Seasonal surge banner; in-app notifications only (no push or email).
- [ ] Bug fixes, responsive and UI polish against [Design.md](Design.md), final seed data.

**Write**
- [ ] Technical infrastructure: stack, architecture diagram, hosting and deployment.
- [ ] Detailed website implementation: annotated screenshots of each core feature.
- [ ] Full pass against the rubric checklist below.

### Phase 5 — Finalization (16 – 19 Nov)
- [ ] Merge all report sections into one formatted document; check citations.
- [ ] End-to-end run-through of the website, exactly as a reviewer would click through it.
- [ ] 17 – 18 Nov reserved as buffer for last-minute fixes only.
- [ ] Submit the website and the final report by Thu 19 Nov.

## Scope

| Live by 19 Nov | Simulated | Out of scope (described in the report only) |
|---|---|---|
| AIT email login, real database | Payments at checkout | Payment gateway integration (Omise / 2C2P) |
| Listings, browse, chat, needs | Escrow holds, payouts, refunds | Real money movement and licensing |
| Fee and deposit rules | Dispute outcomes (admin decides in-app) | Push / email notifications |
| Rental and escrow states, ratings | | Admin approval for items over ~฿6,000 (open) |
| Admin dispute page, basic matching | | Expansion to other campuses |

## Final report rubric checklist

| Section | Status / where it comes from |
|---|---|
| Background | [Proposal.md](Proposal.md) |
| Purpose | Proposal |
| Products and/or services | Proposal |
| E-Business strategy | Proposal |
| E-Business model and revenue model | Proposal + BusinessRules.md |
| Target customers/users | Proposal |
| Existing/potential competitors | Proposal |
| Investment required | Phase 3 draft |
| Projected revenues and expenses | Phase 3 draft |
| Technical infrastructure | Phase 4 |
| Human resources needed | Phase 3 draft |
| Payment methods and delivery | Phase 3 draft |
| Detailed website implementation | Phase 4 |

## Risks

| Risk | Mitigation |
|---|---|
| Scope creep | Keep the scope table above; anything not listed waits. Review weekly. |
| Live demo fails | Keep a backup screen recording for every demo. |
| Report written in a rush | Draft the business sections during Phase 3, not after the build. |
| No buffer | 17 – 18 Nov are buffer days, not build days. |
