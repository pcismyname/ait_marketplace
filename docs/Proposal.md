# PassItOn — Buy, Sell & Rent for the AIT Student Community

**Project proposal, kept current.** This is the proposal submitted on 3 September 2026, updated with every decision made since. It is the source of truth for *what* PassItOn is and *why*. For the money logic see [BusinessRules.md](BusinessRules.md); for what gets built when see [Timeline.md](Timeline.md).

Asian Institute of Technology · Faculty of Science and Technology
AST02.21 E-Business Development and Technology · August 2026 Semester

**Team**

| Name | Email | Role |
|---|---|---|
| Chidsanuphong Pengchai | st127004@ait.asia | Admin, primary contact |
| Lucja Wojtowicz | st127262@ait.asia | |
| Samichi Rungta | st127012@ait.asia | |

---

## Changes since the submitted proposal

| Date | Change | Where it is detailed |
|---|---|---|
| 2026-10-07 | Renamed from "AIT Circular Marketplace" to **PassItOn**, with its own logo and brand | [Design.md](Design.md) |
| 2026-10-07 | Campus shops join as partner sellers (the "B" in C2B2C) | [Business Model Classification](#business-model-classification) |
| 2026-10-07 | Sales get two ways to pay: *pay in person* (free) or *pay with protection* (escrow + small buyer fee) | [BusinessRules.md](BusinessRules.md#5-sales) |
| 2026-10-07 | Escrow fee set to `max(฿30, 3% of deposit)`; commission 10%; premium placement ฿49 / 7 days | [BusinessRules.md](BusinessRules.md#2-fees) |
| 2026-10-07 | Deposits are guided by the platform: suggested by category, ฿200 – ฿3,000 | [BusinessRules.md](BusinessRules.md#3-deposits) |
| 2026-10-07 | Course build has no payment gateway; payments and escrow are simulated in the app | [Timeline.md](Timeline.md#scope-decision-no-payment-gateway) |

---

## Background

AIT's international student population turns over on a fixed, predictable cycle: most students arrive for a 1–2 year program and leave en masse at set points in the academic calendar. Every intake, new students need to furnish a room and set up daily life from scratch; every outtake, departing students are trying to offload furniture, electronics, kitchenware, bicycles, textbooks, and equipment before flying home.

Today this happens through scattered Facebook groups and LINE chats, a system that works, but poorly. Posts get buried in a chat feed within hours, there's no way to search by category or filter by "available now vs. available next month," and there's no mechanism to rent something short-term instead of buying it outright, even though a huge share of what students need (a rice cooker, a badminton racquet, a textbook for one course) is only needed for a semester, not permanently. The result: useful items get thrown away, students overpay buying things new that they'll discard in a year, and there's no safety net for rentals since nobody can hold a deposit inside a Facebook group.

## Literature Review

The literature supporting this project falls into two categories: papers that establish and frame the problem the platform addresses, and papers that justify the specific design decisions that differentiate it from existing informal channels.

### Problem-Framing Literature

Ismail et al. (2020) document a near-identical problem to the one this project addresses: university students currently rely on scattered WhatsApp/social media channels to buy, sell, and promote goods and services, with no dedicated platform, no structured trust mechanism, and no way to search or filter listings (DOI: 10.11591/ijeecs.v19.i1.pp420-427). Their response, a closed, university-verified online marketplace, is close to a direct precedent for this project, confirming that the "informal channel" gap is a documented, recurring structural problem across institutions, not one unique to AIT.

Godinho Filho et al. (2024) extend this problem-framing by empirically evaluating why informal chat-based trading (specifically WhatsApp) falls short as a trading mechanism. Using the UTAUT2 technology-acceptance framework, they find that initial trust, perceived risk, and habitual use strongly determine whether users engage in this kind of unstructured second-hand exchange. This paper is useful evidence that informal peer-to-peer channels are inherently trust- and risk-limited by design, reinforcing the argument that a chat group, however popular, has a structural ceiling that a dedicated platform can overcome.

### Design-Justification Literature

Three papers justify the specific mechanisms this project proposes to overcome that ceiling.

The Sustainability (2020) study on trust-building mechanisms in the sharing economy (Li & Wang) surveyed 209 providers and found that concrete mechanisms like personal safety guarantees, property protection, and review systems were significantly more influential in building provider trust than abstract assurances. This directly supports the project's core design choice: a refundable deposit is a concrete trust mechanism, whereas AIT email verification alone is closer to an abstract assurance, and the literature suggests the former will do more to build the trust needed for rentals to succeed.

Marth et al. (2022) examine how perceived risk deters participation in peer-to-peer platforms, and test which combinations of trust-building mechanisms and external regulation most effectively reduce that risk for both providers and consumers. This paper grounds the platform's dispute-resolution and escrow-release process academically, framing it not merely as a feature, but as a documented risk-reduction mechanism that determines whether students trust the platform enough to rent an item rather than only buy or sell it outright.

Finally, Lu and Zhang's (2020) conjoint analysis of buyer decision-making across seven marketplace attributes found that effectiveness of dispute resolution was the single most important factor to buyers, more important than usability, logistics, or feedback mechanisms. This finding directly supports both the platform's feature prioritization and its revenue model: the service buyers value most is exactly the service this project's escrow fee and buyer protection fee monetize, suggesting the differentiator is not just structurally novel but demonstrably aligned with what buyers actually prioritize when choosing where to transact.

## Purpose

- Give AIT students one searchable, structured place to buy, sell, and rent everyday items instead of choosing between "own it forever" or "do without."
- Use AIT's predictable academic calendar to proactively match outgoing students' items with incoming students' needs, before either side has to go looking.
- Reduce waste and unnecessary spending, especially for international students settling in short-term.
- Make renting viable (not just selling) by solving the one thing peer groups can't: holding a deposit and handling disputes when something gets damaged or not returned.

## Business Model Classification

The platform operates as a **C2B2C** model. Students transact directly with each other (C2C) for peer-to-peer sales and rentals, while PassItOn acts as the intermediary business (B) that provides trust infrastructure: identity verification, deposit escrow, and dispute resolution. **Campus shops** also join as partner sellers, listing new stock and rental fleets next to student listings under the same escrow rules. It is framed as a closed e-Community, exclusive to AIT students and verified through their AIT student email, rather than an open public marketplace.

What distinguishes it structurally from an informal channel like a Facebook group or LINE chat:

- **Calendar-aware matching:** AIT's academic intake/outtake dates are fixed and predictable, so the platform can proactively surface departing students' listings to incoming students before either party starts searching. Incoming students can even pre-register needs ("I'll need a rice cooker and a bicycle in August") ahead of arrival, and the system auto-matches them.
- **Rent as a first-class option, not an afterthought:** items only needed for a semester (a textbook, a camera, a kitchen appliance) can be rented rather than bought outright. The platform holds a refundable deposit, which is the real trust mechanism.
- **Item lifecycle tracking:** the same item can be resold multiple times across cohorts, with a visible ownership history (e.g., "3rd owner, still in the AIT community"), turning individual transactions into a visible circular economy rather than disconnected one-off posts.
- **Structured search and filtering:** by category, price, sale-vs-rent status, and campus pickup location, which a chronological chat feed cannot support.

## Products / Services (Features)

- **Listing creation** (For Sale or For Rent) with photos, description, price, condition, and campus pickup location (dormitory building, faculty area). Rentals carry a deposit suggested by category and adjustable by the owner within ฿200 – ฿3,000.
- **Category browsing and search** across furniture, electronics, bicycles, textbooks, kitchen & household items, sports equipment, and other categories.
- **Pre-arrival registration:** incoming students log what they'll need before landing in Thailand, auto-matched against upcoming outgoing listings.
- **In-platform private chat** for questions, negotiation, and arranging pickup logistics.
- **Deposit escrow for rentals:** holds a refundable deposit, released after confirmed return in good condition, with a dispute-resolution process if damage occurs.
- **Buyer protection for sales (optional):** a buyer can choose to pay through the platform so the money is held in escrow until handover; or pay the seller in person for free.
- **Item history / lifecycle view:** shows how many times an item has changed hands within the AIT community.
- **Rating system** for sellers, buyers, and renters after each completed exchange.
- **Automated seasonal surge highlighting:** "move-out" and "new arrival" listings are promoted automatically around semester start/end dates.
- **Premium placement:** frequent listers can pay for top placement in search and matching.

In the course build, payments, escrow holds, payouts and refunds are simulated inside the app; no payment gateway is integrated (see [Timeline.md](Timeline.md#scope-decision-no-payment-gateway)).

## E-Business Strategy

- **Focus/niche strategy:** deliberately narrow (AIT students only) rather than broad, trading market size for trust and relevance.
- **Differentiation:** calendar-aware matching + escrow are things generic marketplaces structurally can't offer.
- **Network effects:** value increases as more of each incoming/outgoing cohort joins; seed adoption via partnership with the AIT housing office or student union for a pilot semester.
- **Growth path:** start with one dorm/program cohort → expand campus-wide → evaluate expansion to AIT staff/faculty, short-program exchange students, and nearby campuses. Cost estimates show PassItOn is viable as a lean, student-run or AIT-supported service at AIT alone; growing beyond that means more campuses ([BusinessRules.md](BusinessRules.md#10-planning-numbers-for-the-report-not-for-code)).

## Revenue Model

PassItOn **monetizes trust, not access**: the core "replace Facebook groups" use case stays free, and the platform earns only where it provides infrastructure that peer-to-peer chat groups cannot replicate. Exact formulas are in [BusinessRules.md](BusinessRules.md#2-fees).

- **Free listing.** Every sale and rental listing is free, and a sale paid in person stays free. This keeps adoption frictionless and encourages students to migrate off Facebook/LINE groups without a paywall.
- **Rental commission.** 10% of the rental fee, paid by the renter at booking. This is the platform's primary revenue stream, justified by transaction volume rather than by charging for access: students only pay when they complete a rental.
- **Escrow/deposit handling fee.** `max(฿30, 3% of deposit)` per rental, paid by the renter, for holding the refundable deposit and administering dispute resolution. It scales with the deposit so payment fees on large deposits are covered. This fee is the platform's core differentiator: it monetizes the one function a Facebook or LINE group is structurally incapable of providing, a neutral third party holding funds and adjudicating disputes. Lu and Zhang's (2020) finding that dispute-resolution effectiveness is the single most important factor in buyers' marketplace choice directly supports building revenue around this service rather than around advertising or listing fees.
- **Buyer protection fee (optional).** ฿10 + 3% of the price when a buyer chooses to pay for a sale with protection. This follows the Vinted model: free to sell, buyers pay for protection.
- **Premium placement.** ฿49 for 7 days at the top of search and matching, for frequent listers.

Sellers and owners always receive their full price; platform fees are paid on top by the buyer or renter.

## Target Customers / Users

- **Primary: AIT students**, in two behavioral segments:
  - **Outgoing students** (sellers / renters-out): deadline-driven, motivated to offload furniture, electronics, and household items quickly before flying home; often price-flexible in exchange for a fast, guaranteed sale.
  - **Incoming students** (buyers / renters-in): need-driven and time-sensitive, often before physically arriving in Thailand; the primary audience for pre-arrival need registration.
- **Secondary:** AIT staff/faculty and short-program exchange students.
- **Partners:** campus shops, listing new stock and rental fleets under the same rules.

## Existing / Potential Competitors

| Category | Example | How they compare |
|---|---|---|
| Direct/informal incumbents | AIT Facebook groups, LINE chat groups | Current default solution; free and already adopted, but lack search/filtering, have no rental mechanism, and cannot hold a deposit, which is the exact gap this project fills. Godinho Filho et al. (2024) provide empirical evidence that this format is structurally trust-limited. |
| General resale platforms | Vinted, Carousell, Facebook Marketplace | Broader user base and mature UX, but not campus-specific: no student verification, no calendar-aware matching, and limited-to-no rental/deposit infrastructure for short-term needs. |
| P2P rental platforms | Fat Llama | Closest functional analog: peer-to-peer rental with deposit-holding built in. However, it is a general consumer platform, not tailored to an academic calendar or a closed, trust-verified community, which is AIT's structural advantage. |
| Campus marketplace research/prototypes | Ismail et al.'s university marketplace (2020) | Validates the "closed student marketplace" model, but does not include rental-with-deposit or calendar-aware matching, this project's two key differentiators. |

## References

- Filho, Moacir Godinho, et al. "Circular Economy via Chat: Evaluation of Adoption and Use of WhatsApp Instant Messaging Platform for Trading Second-hand Products." *Journal of Cleaner Production*, vol. 460, May 2024, p. 142510. https://doi.org/10.1016/j.jclepro.2024.142510
- Ismail, Mohd Fahmi, et al. "Student Online Marketplace for University Community." *Indonesian Journal of Electrical Engineering and Computer Science*, vol. 19, no. 1, May 2020, p. 420. https://doi.org/10.11591/ijeecs.v19.i1.pp420-427
- Li, Liwei, and Wei Wang. "The Effects of Online Trust-Building Mechanisms on Trust in the Sharing Economy: The Perspective of Providers." *Sustainability*, vol. 12, no. 5, Feb. 2020, p. 1717. https://doi.org/10.3390/su12051717
- Lu, Baozhou, and Song Zhang. "A Conjoint Approach to Understanding Online Buyers' Decisions Towards Online Marketplaces." *Journal of Theoretical and Applied Electronic Commerce Research*, vol. 15, no. 3, Jan. 2020, pp. 69–83. https://doi.org/10.4067/s0718-18762020000300106
- Marth, Sarah, et al. "Sharing on Platforms: Reducing Perceived Risk for Peer-to-peer Platform Consumers Through Trust-building and Regulation." *Journal of Consumer Behaviour*, vol. 21, no. 6, June 2022, pp. 1255–67. https://doi.org/10.1002/cb.2075
