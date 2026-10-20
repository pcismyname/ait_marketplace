# Final Report Outline — AIT Circular Marketplace

**Course:** AST02.21 — E-Business Development and Technology
**Due:** 19 November 2026
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
- **Standard terms (use identically throughout):** listing price · commission · deposit · deposit-handling fee · escrow · dispute window (24 hours) · buyer/seller · renter/owner · outgoing/incoming students.

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
| 6 | **E-business model and revenue model** | 3 | C2B2C diagram (value flow), closed e-community; **fee table and two worked examples (below)**; revenue streams; premium placement status | Rewrite |
| 7 | **Target customers/users** | 1.5 | Outgoing and incoming personas, needs, pain points, segment size (sourced), adoption barriers | Expand |
| 8 | **Competitors** (+ ★ SWOT) | 2 | Feature-comparison matrix (verification, rental, escrow, calendar matching, search/filter, fees); positioning statement; SWOT | Expand |
| 9 | **Investment required** | 1.5 | One-off vs. recurring costs, each with an assumption and source; contingency | New |
| 10 | **Projected revenues and expenses** | 3 | Assumptions table, 3 scenarios, 3-year view by semester (seasonality), gateway fees as expense, break-even, sensitivity | New |
| 11 | **Technical infrastructure** | 3 | Architecture diagram, why this stack, ERD, security (RLS, domain gating), escrow state machine and auto-release job, deployment/CI, scalability | New |
| 12 | **Human resources** | 1 | Build-phase roles; post-launch roles (maintainer, dispute handler/moderator, campus ambassadors); time estimates | New |
| 13 | **Payment methods and delivery** | 2 | Payment methods, checkout breakdown, escrow flow, payouts, refunds, 24h dispute window; delivery = campus handover points | New |
| 14 | **Website implementation** | 5 | Page-by-page walkthrough with screenshots, the four user flows, key algorithms, implemented-vs-planned table, testing and usability results, live URL | New |
| ★ 15 | **Risk, legal and ethical considerations** | 1.5 | Risk register; payment/e-money regulation note (prototype uses sandbox + ledger); PDPA/privacy; prohibited items; use of AIT name/domain | New |
| ★ 16 | **Conclusion and future work** | 1 | What was achieved, limitations, P2 items as future work | New |

### Back matter
- **References** (APA 7, all DOIs verified)
- **Appendices:** A — user-flow diagrams · B — database schema · C — test scripts and results · D — usability survey and results · E — financial model tables · F — page map

---

## 3. Content to paste into Section 6 (Revenue model)

### Fee structure

| Item | Rate | Paid by | Refundable? |
|---|---|---|---|
| Platform commission | 10% of listing price (sale price or rental fee) | Buyer / renter, added on top | No |
| Deposit-handling fee | 4% of deposit (rentals only) | Renter | No |
| Deposit | Set by owner | Renter | Yes, subject to dispute outcome |
| Premium placement | Planned feature; not billed in the prototype | Lister | — |

### Worked examples (THB, illustrative, before gateway costs)

| | Sale | Rental |
|---|---|---|
| Listing price / rental fee | 100 | 200 |
| Deposit | — | 1,000 |
| Commission (10%) | 10 | 20 |
| Deposit-handling fee (4%) | — | 40 |
| **Customer pays** | **110** | **1,260** |
| Seller / owner receives | 100 | 200 |
| Deposit returned (no dispute) | — | 1,000 |
| **Platform gross revenue** | **10** | **60** |

### Why 4% for the deposit-handling fee (rationale to include)
1. The deposit is charged through the payment gateway and later refunded; the platform may bear the processing cost on money it never keeps, so the fee needs to cover that and leave a margin (verify the gateway's fee and refund policy and cite it).
2. It stays below the 10% headline commission, so the add-on feels small.
3. It is non-refundable because it pays for a service delivered regardless of outcome: holding funds and running dispute resolution — the capability Lu & Zhang (2020) identify as the most valued marketplace attribute.
4. Sensitivity: show 3% / 4% / 5% in Section 10. Note that fee amounts scale with deposit size, so expensive items (e.g., cameras) carry larger absolute fees — discuss whether a cap is worth considering.

---

## 4. Figures and tables checklist

**Figures**
- [ ] Fig. 1 — Academic turnover cycle (arrivals/departures across the year)
- [ ] Fig. 2 — C2B2C value-flow diagram
- [ ] Fig. 3 — Money flow for a sale and for a rental (who pays what, what is held, what is released)
- [ ] Fig. 4 — Page map
- [ ] Fig. 5–8 — The four user flows (seller, buyer, owner, renter), updated to 24h and the deposit fee
- [ ] Fig. 9 — System architecture
- [ ] Fig. 10 — Database ERD
- [ ] Fig. 11 — Escrow state machine
- [ ] Fig. 12+ — Screenshots in flow order (landing → signup → browse → listing → checkout → escrow status → confirm → dispute → chat → needs → dashboards → admin)

**Tables**
- [ ] Literature → design-decision mapping
- [ ] Competitor feature matrix
- [ ] Fee structure and worked examples
- [ ] Investment (one-off / recurring)
- [ ] Financial assumptions
- [ ] Scenario outputs and break-even
- [ ] Deposit-fee sensitivity
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
| Oct 27 – Nov 2 | Rewrite §5–6 for the final model; source market-size inputs; start the financial spreadsheet |
| Nov 3 – 9 | Finance sections (9–10), technical (11), payments (13), HR (12) drafted |
| Nov 10 – 16 | Implementation chapter with real screenshots and test results; risk/legal; conclusion; executive summary last |
| Nov 17 – 18 | Consistency edit, proofread, PDF export check, submission checklist |
