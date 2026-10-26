# Pass It On — Business Rules

**Single source of truth for money, deposit, escrow and dispute logic.**
Code that charges, holds, releases or refunds money must follow this file. Update this file first whenever a rule changes, then the code.

**Status:** decided by the team on 2026-10-07. The team went with these rules as written. Rules marked **(open)** are still undecided; don't build them beyond a placeholder.

**No payment gateway in the course build.** Every payment, escrow hold, payout and refund is simulated: a state change inside the app, with no real money and no gateway calls. The gateway details in section 7 describe a real launch for the report only. See [Timeline.md](Timeline.md) for what gets built by 19 November.

Related: [Proposal.md](Proposal.md) (what and why), [Timeline.md](Timeline.md) (what is built by when), [Design.md](Design.md) (visuals), [UserFlows.md](UserFlows.md) (routes and flows), [Mapping&UF.md](Mapping&UF.md) (early page map; where it disagrees with this file, this file wins).

---

## 1. Business model

- **C2B2C, closed community.** Students trade with each other (C2C). Pass It On is the business in the middle providing trust: AIT email verification, deposit escrow, dispute resolution. Campus shops (`UserKind = 'shop'`) are partner sellers under the same rules.
- **Monetize trust, not access** (the Vinted model). Listing is always free. Fees apply only where the platform holds money or gives visibility.

## 2. Fees

All amounts in THB. Round every computed fee to the nearest baht.

| Fee | Who pays | Amount | When |
|---|---|---|---|
| Rental commission | Renter | 10% of the rental fee | At booking |
| Escrow handling fee | Renter | `max(30, 3% of deposit)` | At booking |
| Buyer protection fee (sales) | Buyer, only if they choose "Pay with protection" | `10 + 3% of sale price` | At checkout |
| Sale commission | Seller, on protected sales only | 10% of the sale price the seller keeps | Taken from the seller's payout |
| Premium placement | Lister | 49 for 7 days | When enabled |
| Listing | — | Free | — |
| Sale paid in person | — | Free for both sides, no protection | — |

Why the escrow fee scales: gateway fees on a deposit are not returned when the deposit is refunded later, so a flat ฿30 loses money on large deposits paid by card (a ฿800 deposit costs about ฿31 by card).

### Rental quote

```
rentalFee   = listing.price
commission  = round(rentalFee * 0.10)
escrowFee   = max(30, round(deposit * 0.03))
platformFee = commission + escrowFee
totalDueNow = rentalFee + platformFee + deposit
refundable  = deposit
```

Example (mini fridge): 250 + 25 + 30 + 800 = **฿1,105**.

### Sale quote

```
inPerson:  total = price                         (no escrow, no protection)
protected: protectionFee    = 10 + round(price * 0.03)
           total            = price + protectionFee   (buyer pays; escrow, dispute window applies)
           sellerCommission = round(price * 0.10)
           sellerPayout     = price - sellerCommission
```

Example (desk lamp, ฿400, protected): the buyer pays 400 + 22 = **฿422**; the seller receives 400 − 40 = **฿360**; the platform keeps 22 + 40 = ฿62.

The sale commission (decided 2026-10-26) is the seller-side counterpart of the rental commission: the platform only earns it where it holds the money. It is never charged on in-person sales, because the platform never touches that money. If a dispute refunds part of the price, the commission is 10% of what the seller actually keeps, `round((price - refund) * 0.10)`, so a full refund means no commission (§6). Purchases paid before 2026-10-26 were quoted without it and keep a commission of ฿0.

## 3. Deposits

- **The platform suggests, the owner adjusts within limits.** The owner can't type any amount.
- **Rule:** deposit = 30–50% of the item's replacement value, clamped to **min ฿200, max ฿3,000**.
- **A rental listing must have a deposit ≥ ฿200.** An empty or ฿0 deposit is invalid.
- **Suggested starting points by category:**

  | Category | Suggested deposit |
  |---|---|
  | Kitchen & household | 300 |
  | Textbooks | 200 |
  | Sports | 300 |
  | Furniture | 500 |
  | Electronics | 800 |
  | Bicycles | 1,000 |
  | Other | 300 |

  Furniture, sports and other are my estimates; the rest come from the progress deck.
- **Items worth more than about ฿6,000** (where 50% would exceed the cap) can be sold, but renting them needs admin approval. **(open)**: how approval works.

## 4. Rentals

- **Periods:** per week, per month, per semester (`rentalDueDate` in `lib/fees.ts`: 7 / 30 / 120 days).
- **Booking flow:** request → owner approves → renter pays `totalDueNow` → handover.
- **Handover** (clarification added 2026-10-25, not a new money rule): the **renter** confirms the handover in the app at the pickup point, with at least one photo of the item's condition, once they have the item; the owner waits for that confirmation before letting the item go. This starts the rental period and the 48-hour payout clock. The owner can't confirm it alone, so an owner can't start the payout for an item they never handed over.
- **Owner payout:** the rental fee goes to the owner **48 hours after handover** if no dispute is filed. The deposit stays held until the return. If a dispute is open at that time, the fee waits for the admin's decision; a decision made earlier doesn't bring the payout forward.
- **Return:** the owner confirms the condition with photos and compares them with the handover photos. Every handover and return needs at least one photo (§9).
- **Late return:** a daily late fee is taken from the deposit: `ceil(rentalFee / periodDays)` per day late.
- **Missing:** more than **7 days** late counts as missing. The full deposit goes to the owner.

### Rental states

```
requested → approved → paid (deposit held) → active
active → return-pending → released            (good condition or no claim in 48h)
active → return-pending → disputed → resolved (admin splits the deposit)
active → overdue → missing                    (7+ days late, deposit to owner)
```

Two more states complete the booking step (a clarification of the flow above, not a money rule; no money has moved in either):

```
requested → declined                 (the owner says no)
requested / approved → cancelled     (renter or owner drops it before payment)
```

All twelve states are persisted in `rentals.phase` and change only through the database functions in [Database.md](Database.md).

## 5. Sales

- **In person:** the buyer pays the seller directly. No escrow and no dispute support. The listing is marked sold by the seller.
- **With protection:** the buyer pays through the platform. The money is held until handover plus 48 hours, then released to the seller, minus the 10% sale commission (§2), unless the buyer disputes.

## 6. Disputes

- **Window:** 48 hours, starting at handover (sales) or at return (rentals). Funds auto-release when the window closes with no dispute. Confirming early releases them at once.
- **Who decides:** the platform admin (the team), using chat history and before/after photos.

| Finding | Outcome |
|---|---|
| Normal wear | ฿0 to the owner, full deposit refunded |
| Repairable damage | Repair cost to the owner, the rest refunded |
| Lost or destroyed | Full deposit to the owner |
| Sale item not as described | Full or partial refund to the buyer; the seller gets the rest minus 10% commission on it |
| Sale item as described (claim rejected) | No refund; the seller is paid the price minus the 10% commission |

- **Sales** (added 2026-10-25 to match the built admin options and `figures/buyer_userflow.png`, where "Item not as described? No" releases the payment to the seller; **team to confirm**): the admin can reject a buyer's claim, and the **buyer protection fee is not refunded**, even on a full refund. Like the rental escrow fee, it pays for holding the money and running the dispute, which happened.
- Claims and repair or refund amounts are whole baht (§2).
- The owner can never receive more than the deposit. The deposit is the limit of the renter's liability.

## 7. Who holds the money

- **The owner never holds the deposit.**
- **Course build:** payments are simulated only, with no gateway integration (not even a test mode). Checkout records the payment method the student picks (`promptpay`, `card` or `wallet`) and moves the transaction to its next state; escrow holds, payouts and refunds are state changes, not money movements.
- **Real launch (for the report, not built):** Thailand's Payment Systems Act treats "receipt of payment on behalf of sellers" as a licensed service. Money must be held by the licensed gateway (or a licensed partner), and paid out on the platform's instruction, not held in the team's own bank account. **(open)**: confirm Omise's marketplace payout setup covers this.
- **Gateway (real launch):** Omise (cards 3.65%, PromptPay 1.65%, both + 7% VAT).
- **Gateway fees (real launch):** paid by the platform out of the commissions, escrow fee and protection fee. Renters always get the full deposit back.

## 8. Payment methods

- `promptpay`: the default and cheapest option.
- `card`: needed for incoming international students who don't have a Thai bank account yet.
- `wallet`: refunded deposits can land here first (in the prototype).

## 9. Delivery

- No shipping. Handover happens at campus pickup points (dorm buildings, faculty areas).
- Pre-arrival matches are held until the incoming student arrives.
- Rental returns need photos of the item's condition.

## 10. Planning numbers (for the report, not for code)

- AIT has about 2,500 full-time students. Assume about 30% are active each semester and 1 in 5 of those rents once: **about 150 rentals per semester** (low case 75, high case 300).
- Net revenue is about ฿34 per rental (฿60 revenue minus about ฿26 gateway fees, assuming 70% PromptPay and 30% card, with a ฿300 rental and a ฿700 deposit).
- **Lean pilot:** about ฿5,700 cost per semester against about ฿7,000 net revenue. **With paid staff:** about ฿23,000 per semester, which needs about 600 rentals. So the platform is viable as a lean, student-run or AIT-supported service.

---

## Current code vs. these rules

Updated 2026-10-25 for branch `feat/p0-core`; sale commission added 2026-10-26 (branch `feat/seller-sale-commission`, migration `20261026000000_sale_commission.sql`). The server side is in `supabase/migrations/` (`20261025010000_p0_core.sql`, the four `20261025020…` feature migrations and `20261025030000_review_fixes.sql`); the contract is in [Database.md](Database.md). End-to-end evidence: [tests/e2e/RESULTS.md](../tests/e2e/RESULTS.md).

| Rule | Code today | Change needed |
|---|---|---|
| Escrow fee `max(30, 3% of deposit)`; commission 10% | `lib/fees.ts` and server-side `quote_rental` (same JS rounding); parity tested (pgTAP + `npm run test:db`). `pay_rental` charges the server quote; checkout shows each line. | — |
| Buyer protection fee `10 + 3%`; sale commission 10% from the seller on protected sales; sales in person or with protection | `computeSaleQuote` + `quote_sale` (protection fee, seller commission, seller payout); `transactions.seller_commission` stores the quote and `release_sale` deducts the commission on the kept amount, booking it as a `platform_fee` (migration `20261026000000_sale_commission.sql`); `transactions` with in-person (no escrow, no dispute, seller marks sold) and protected (held until handover + 48 h) states; status page `/transaction/[id]`, confirm receipt `/transaction/[id]/confirm` | — |
| Premium placement ฿49 for 7 days, paid by the lister | `enable_premium_placement` records the simulated ฿49 charge and sets `featured_until` server-side; clients can't write `featured` directly; featured listings sort first | — |
| Deposit min ฿200 / max ฿3,000, suggested by category, 30–50% of value | Sell and edit forms enforce it (replacement value saved); the database refuses rental listings outside ฿200–฿3,000, fractional amounts, and (when a replacement value is given) deposits outside 30–50% of it; `request_rental` refuses listings without a valid deposit | Admin approval for items over ~฿6,000 (open): placeholder only (form note + `listings.replacement_value`) |
| Payment methods `promptpay` / `card` / `wallet`, simulated | Recorded on the booking, purchase or premium charge; `wallet` pays from the in-app balance (refunds and payouts land there) under a per-user lock, so concurrent payments and withdrawals can't overdraw it; "Demo mode — payments are simulated" note wherever money moves | — |
| Booking flow request → approve → pay → handover | RPCs `request_rental`, `respond_rental`, `pay_rental`, `confirm_handover`; request dialog on the listing, owner requests page `/dashboard/listings/[id]/requests`, checkout only for an approved booking; only the renter confirms the handover, with a photo (enforced in SQL) | — |
| Owner payout 48 h after handover; deposit held until return | `run_escrow_jobs` (pg_cron every 10 min, also run by the app on sign-in and every 5 min while open) pays at `payout_at` on every path, including a dispute resolved early; payout countdown on the rental card and deal page | — |
| Dispute window 48 h, auto-release, early release on confirmation | `file_dispute` only inside the window (`/dispute/new`); job auto-releases; `confirm_return` / `confirm_sale_receipt` release at once; reminders 24 h and 2 h before; admin queue and resolution `/admin/disputes/[id]` with the §6 outcomes; claims and amounts must be whole baht (UI and SQL) | — |
| Sale disputes: claim rejected; protection fee kept | `resolve_dispute(…, 'normal-wear')` on a purchase pays the seller the price minus the commission; the protection fee stays with the platform on every outcome | Team to confirm the §6 addition |
| Rental handovers and returns need condition photos (§4, §9) | Enforced in the UI and in SQL: `confirm_handover`, `mark_returned` and `confirm_return` refuse without at least one uploaded photo under `dispute-evidence/rental/<id>/` (for `confirm_return`, photos from either party count) | — |
| Late fee `ceil(rentalFee / periodDays)` per day, missing after 7 days, owner capped at the deposit | Applied in SQL at the return (`mark_returned`) and by the job (`overdue`, `missing`); `resolve_dispute` caps the owner at the deposit; the UI shows "late fee so far" while overdue | — |
| Who holds the money (simulated) | `wallet_ledger`: held / available / platform rows for every hold, payout, refund and fee; `/dashboard/wallet` shows held vs available and the history | — |
| Refund for a paid booking or protected purchase cancelled before handover | Not possible: paid deals can't be cancelled | Needs a team decision (not in these rules yet) |

## Open questions

- How admin approval works for items worth more than ฿6,000.
- Whether Omise's marketplace payouts cover the licence requirement (report only; no gateway is built).
