# Final Report Outline — AIT Circular Marketplace

**Course:** AST02.21 — E-Business Development and Technology
**Due:** 19 November 2026
**Aligned with [docs/BusinessRules.md](docs/BusinessRules.md):** 24 October 2026. Every fee, deposit, escrow and dispute statement in the report must match that file; if they disagree, BusinessRules.md wins.
**Format:** Business report. The professor gave no format, so the numbered sections below follow her topic list **in her order** (so a grader can tick each item off), with a few additions (marked ★) that a business report normally has.

---

## 1. Format conventions

- **Length:** ~30 pages of body text excluding appendices is the working target. If the professor gives a limit, scale the page budgets below proportionally and move detail into appendices.
- **Headings:** numbered (1, 1.1, 1.2…), short, descriptive.
- **Each section opens with its main point** in one or two sentences, then the evidence.
- **Figures and tables:** numbered, captioned, and referenced in the text ("see Figure 4"). No unreferenced images.
- **Voice:** third person, present tense for how the platform works, past tense for what the team built and tested.
- **Every external fact is cited** (market size, pricing, regulations). Estimates are labelled as estimates with their assumptions shown.
- **Citation style:** pick **APA 7** and use it everywhere. Right now the in-text citations are author–date (APA-like) but the reference list is formatted MLA-style — reformat the list. Also check name order (e.g., the 2024 paper should be listed under *Godinho Filho*, matching the in-text citation). **Verify every reference against its DOI page** — some author initials and page ranges I gave you earlier came from partial search snippets, so trust the DOI landing page, not my earlier messages.
- **Standard terms (use identically throughout):** listing price · rental fee · rental commission · escrow handling fee · buyer protection fee · pay in person / pay with protection · deposit · escrow · dispute window (48 hours) · owner payout · late fee · premium placement · buyer/seller · renter/owner · outgoing/incoming students. Money is in THB, written with ฿.

---

## 2. Structure and page budget

### Front matter

| Part | Pages | Notes |
|---|---|---|
| Cover page | 1 | Course, title, all three names + AIT emails (primary contact marked), date |
| ★ Executive summary | 1 | Write **last**. Problem → solution → model and fees → technology → financial headline → status |
| Table of contents, list of figures/tables | 1 | |

### Body

| § | Section | Pages | Must include | Source / status |
|---|---|---|---|---|
| 1 | **Background** | 1.5 | AIT's turnover cycle, how students trade today, why it fails, consequences; 2–3 *sourced* facts | Reuse proposal; add sources |
| 2 | **Purpose** | 1 | The four goals, each with a measurable indicator (e.g., items reused, cost saved per student) | Reuse; add indicators |
| ★ 3 | **Literature review** | 2 | Problem-framing (Ismail et al.; Godinho Filho et al.) and design-justification (Li & Wang; Marth et al.; Lu & Zhang); **a table mapping each paper → the design decision it supports** | Reuse proposal; add table |
| 4 | **Products and services** | 1.5 | Feature list reflecting what is actually built; flag live vs. planned | Update |
| 5 | **E-business strategy** | 2 | Niche focus, differentiation, network effects, **launch plan** (pilot cohort, AIT housing/student-union partnership, orientation-week outreach), marketing channels, success KPIs | Expand |
| 6 | **E-business model and revenue model** | 3 | C2B2C diagram (value flow), closed e-community; "monetize trust, not access"; **fee table and worked examples (below)**; revenue streams (rental commission, escrow handling fee, buyer protection fee, premium placement ฿49 / 7 days) | Rewrite from [docs/Proposal.md](docs/Proposal.md) + BusinessRules §2 |
| 7 | **Target customers/users** | 1.5 | Outgoing and incoming personas, needs, pain points, segment size (sourced), adoption barriers | Expand |
| 8 | **Competitors** (+ ★ SWOT) | 2 | Feature-comparison matrix (verification, rental, escrow, calendar matching, search/filter, fees); positioning statement; SWOT | Expand |
| 9 | **Investment required** | 1.5 | One-off vs. recurring costs, each with an assumption and source; contingency | New |
| 10 | **Projected revenues and expenses** | 3 | Assumptions table starting from BusinessRules §10 (~150 rentals per semester, low 75 / high 300; ~฿34 net per rental), 3 scenarios, 3-year view by semester (seasonality), gateway fees as a real-launch expense, lean pilot vs. paid staff, break-even, sensitivity | New |
| 11 | **Technical infrastructure** | 3 | Architecture diagram, why this stack, ERD, security (RLS, domain gating), rental state machine (requested → approved → paid → active → return-pending → released / disputed → resolved; active → overdue → missing), auto-release and owner-payout job, fee logic in `lib/fees.ts`, deployment/CI, scalability | New |
| 12 | **Human resources** | 1 | Build-phase roles; post-launch roles (maintainer, dispute handler/moderator, campus ambassadors); time estimates | New |
| 13 | **Payment methods and delivery** | 2 | Payment methods (`promptpay` default, `card`, `wallet`), checkout breakdown, pay in person vs. pay with protection, escrow flow, owner payout 48 h after handover, refunds, late fees, 48-hour dispute window; course build = simulated payments, real launch = licensed gateway (BusinessRules §7); delivery = campus handover points, no shipping | New |
| 14 | **Website implementation** | 5 | Page-by-page walkthrough with screenshots, the four user flows, key algorithms, implemented-vs-planned table, testing and usability results, live URL | New |
| ★ 15 | **Risk, legal and ethical considerations** | 1.5 | Risk register; payment regulation note (prototype simulates all money movement in-app with no gateway; a real launch needs a licensed gateway to hold funds under Thailand's Payment Systems Act); PDPA/privacy; prohibited items; use of AIT name/domain | New |
| ★ 16 | **Conclusion and future work** | 1 | What was achieved, limitations, P2 items as future work | New |

### Back matter
- **References** (APA 7, all DOIs verified)
- **Appendices:** A — user-flow diagrams · B — database schema · C — test scripts and results · D — usability survey and results · E — financial model tables · F — page map

---

## 3. Content to paste into Section 6 (Revenue model)

Copied from [docs/BusinessRules.md](docs/BusinessRules.md) §2–6. If the rules change, update that file first, then this section.

### Fee structure

All amounts in THB; every computed fee is rounded to the nearest baht.

| Fee | Who pays | Amount | When | Refundable? |
|---|---|---|---|---|
| Rental commission | Renter | 10% of the rental fee | At booking | No |
| Escrow handling fee | Renter | `max(฿30, 3% of deposit)` | At booking | No |
| Deposit | Renter | Suggested by category; owner adjusts within 30–50% of replacement value, ฿200–฿3,000 | At booking | Yes, minus late fees or the dispute outcome |
| Buyer protection fee (sales) | Buyer, only if they choose "Pay with protection" | ฿10 + 3% of the sale price | At checkout | No |
| Premium placement | Lister | ฿49 for 7 days | When enabled | No |
| Listing | — | Free | — | — |
| Sale paid in person | — | Free, no escrow, no dispute support | — | — |

Sellers and owners always receive their full price; platform fees are paid on top by the buyer or renter. The owner never holds the deposit.

Suggested deposits by category: kitchen & household 300 · textbooks 200 · sports 300 · furniture 500 · electronics 800 · bicycles 1,000 · other 300. Renting items worth more than about ฿6,000 needs admin approval (how is still open; describe it as future work).

### Worked examples (THB, before gateway costs)

| | Sale, in person | Sale, with protection | Rental (mini fridge) |
|---|---|---|---|
| Sale price / rental fee | 1,000 | 1,000 | 250 |
| Deposit | — | — | 800 |
| Rental commission (10%) | — | — | 25 |
| Escrow handling fee `max(30, 3%)` | — | — | 30 (3% = 24, so the ฿30 minimum applies) |
| Buyer protection fee (10 + 3%) | — | 40 | — |
| **Customer pays** | **1,000** | **1,040** | **1,105** |
| Seller / owner receives | 1,000 (directly) | 1,000 (after handover + 48 h) | 250 (48 h after handover) |
| Deposit returned (good return) | — | — | 800 |
| **Platform gross revenue** | **0** | **40** | **55** |

Extra cases worth one line each in the report:
- **Larger deposit:** rental fee 500, deposit 2,000 → commission 50 + escrow fee 60 → renter pays 2,610; platform keeps 110. Shows the fee scaling above the ฿30 floor.
- **Late return:** mini fridge at ฿250 per month (30 days) → late fee `ceil(250 / 30)` = ฿9 per day, taken from the deposit; 3 days late → ฿27 to the owner, ฿773 refunded. More than 7 days late counts as missing: the full ฿800 goes to the owner.
- **Dispute outcomes** (the admin decides from chat history and before/after photos, within the 48-hour window): normal wear → ฿0 to the owner, full deposit refunded; repairable damage → repair cost to the owner, the rest refunded; lost or destroyed → full deposit to the owner; sale item not as described → full or partial refund to the buyer. The owner can never receive more than the deposit.

### Why the escrow handling fee is `max(฿30, 3% of deposit)` (rationale to include)
1. **Gateway fees on a deposit are not returned when the deposit is refunded.** In a real launch the deposit is charged through the gateway and refunded later, so the platform pays the processing cost on money it never keeps. A flat ฿30 loses money on large deposits paid by card: an ฿800 deposit costs about ฿31 by card (Omise 3.65% + 7% VAT). Scaling at 3% covers that cost on large deposits; the ฿30 floor covers small ones. Cite Omise's published pricing and refund policy.
2. **It stays small next to the rental itself:** ฿30 for most student deposits (up to ฿1,000), and at most ฿90 at the ฿3,000 deposit cap, which also caps the fee.
3. **It is non-refundable** because it pays for a service delivered regardless of outcome: holding the deposit and running dispute resolution, the capability Lu & Zhang (2020) identify as the most valued marketplace attribute.
4. **Gateway fees are the platform's cost** (paid out of the commission and the escrow fee), so renters always get the full deposit back.

### Sensitivity guidance for Section 10
- The rates above are decided (BusinessRules §2). Sensitivity tables are "what if" analysis, not alternative proposals.
- Vary: escrow fee floor (฿20 / ฿30 / ฿40) and rate (2% / 3% / 4%); rental commission (8% / 10% / 12%); payment mix (70/30 PromptPay/card as base vs. more card); adoption (75 / 150 / 300 rentals per semester); share of sales paid with protection.
- Base case from BusinessRules §10: ฿300 rental + ฿700 deposit → ฿30 commission + ฿30 escrow fee = ฿60 revenue, minus about ฿26 gateway fees (real launch, 70% PromptPay / 30% card) = about ฿34 net per rental.
- Cost cases from §10: lean pilot about ฿5,700 per semester vs. about ฿7,000 net revenue; with paid staff about ฿23,000 per semester, which needs about 600 rentals.

### Course build vs. real launch (state this in Sections 13 and 15)
- **Course build:** no payment gateway, not even a test mode. Checkout records the method the student picks (`promptpay`, `card` or `wallet`) and moves the transaction to its next state; escrow holds, payouts and refunds are state changes, not money movements.
- **Real launch (described, not built):** money is held by a licensed gateway or partner and paid out on the platform's instruction, never in the team's own bank account (Thailand's Payment Systems Act treats receiving payment on behalf of sellers as a licensed service). Gateway: Omise (cards 3.65%, PromptPay 1.65%, both + 7% VAT). Whether Omise's marketplace payouts cover the licence requirement is still **open**.

---

## 4. Figures and tables checklist

**Figures**
- [ ] Fig. 1 — Academic turnover cycle (arrivals/departures across the year)
- [ ] Fig. 2 — C2B2C value-flow diagram
- [ ] Fig. 3 — Money flow for an in-person sale, a protected sale and a rental (who pays what, what is held, when the owner is paid, what is released)
- [ ] Fig. 4 — Page map
- [ ] Fig. 5–8 — The four user flows (seller, buyer, owner, renter), regenerated from docs/Mapping&UF.md: 48-hour dispute window, escrow handling fee `max(฿30, 3%)`, booking approval, owner payout 48 h after handover, late/missing path
- [ ] Fig. 9 — System architecture
- [ ] Fig. 10 — Database ERD
- [ ] Fig. 11 — Rental and protected-sale state machine (BusinessRules §4)
- [ ] Fig. 12+ — Screenshots in flow order (landing → signup → browse → listing → checkout → escrow status → confirm → dispute → chat → needs → dashboards → admin)

**Tables**
- [ ] Literature → design-decision mapping
- [ ] Competitor feature matrix
- [ ] Fee structure and worked examples
- [ ] Investment (one-off / recurring)
- [ ] Financial assumptions
- [ ] Scenario outputs and break-even
- [ ] Dispute outcomes (BusinessRules §6)
- [ ] Fee sensitivity (escrow fee floor/rate, commission, payment mix, adoption)
- [ ] Implemented vs. planned
- [ ] Risk register
- [ ] Test results and usability results

---

## 5. Suggested writing split

| Workstream | Sections |
|---|---|
| **C — Report, research and finance** | Exec summary, 1–3, 5–10, 12, 15–16 |
| **A — Backend and payments** | 11, 13, plus the escrow/auto-release parts of 14 |
| **B — Frontend, UX and QA** | 4, 14 (walkthrough, screenshots, testing, usability study) |

Then **one person does a full consistency edit** (terminology, every number, route names, tense) before the peer-review pass.

---

## 6. Timeline for the report

| Dates | Report milestone |
|---|---|
| Oct 20 – 26 | Skeleton in a shared doc; paste reused sections (1, 2, 3, 4, 7, 8) and flag what needs updating; fix references |
| Oct 27 – Nov 2 | Rewrite §5–6 for the final model (BusinessRules.md); source market-size inputs; start the financial spreadsheet |
| Nov 3 – 9 | Finance sections (9–10), technical (11), payments (13), HR (12) drafted |
| Nov 10 – 16 | Implementation chapter with real screenshots and test results; risk/legal; conclusion; executive summary last |
| Nov 17 – 18 | Consistency edit, proofread, PDF export check, submission checklist |
