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
| Premium placement | Lister | 49 for 7 days | When enabled |
| Listing | — | Free | — |
| Sale paid in person | — | Free, no protection | — |

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
protected: protectionFee = 10 + round(price * 0.03)
           total = price + protectionFee         (escrow, dispute window applies)
```

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
- **Owner payout:** the rental fee goes to the owner **48 hours after handover** if no dispute is filed. The deposit stays held until the return.
- **Return:** the owner confirms the condition with photos and compares them with the handover photos.
- **Late return:** a daily late fee is taken from the deposit: `ceil(rentalFee / periodDays)` per day late.
- **Missing:** more than **7 days** late counts as missing. The full deposit goes to the owner.

### Rental states

```
requested → approved → paid (deposit held) → active
active → return-pending → released            (good condition or no claim in 48h)
active → return-pending → disputed → resolved (admin splits the deposit)
active → overdue → missing                    (7+ days late, deposit to owner)
```

Current code has `RentalPhase = 'active' | 'return-pending' | 'released' | 'disputed'`; the other states are still to build.

## 5. Sales

- **In person:** the buyer pays the seller directly. No escrow and no dispute support. The listing is marked sold by the seller.
- **With protection:** the buyer pays through the platform. The money is held until handover plus 48 hours, then released to the seller unless the buyer disputes.

## 6. Disputes

- **Window:** 48 hours, starting at handover (sales) or at return (rentals). Funds auto-release when the window closes with no dispute. Confirming early releases them at once.
- **Who decides:** the platform admin (the team), using chat history and before/after photos.

| Finding | Outcome |
|---|---|
| Normal wear | ฿0 to the owner, full deposit refunded |
| Repairable damage | Repair cost to the owner, the rest refunded |
| Lost or destroyed | Full deposit to the owner |
| Sale item not as described | Full or partial refund to the buyer |

- The owner can never receive more than the deposit. The deposit is the limit of the renter's liability.

## 7. Who holds the money

- **The owner never holds the deposit.**
- **Course build:** payments are simulated only, with no gateway integration (not even a test mode). Checkout records the payment method the student picks (`promptpay`, `card` or `wallet`) and moves the transaction to its next state; escrow holds, payouts and refunds are state changes, not money movements.
- **Real launch (for the report, not built):** Thailand's Payment Systems Act treats "receipt of payment on behalf of sellers" as a licensed service. Money must be held by the licensed gateway (or a licensed partner), and paid out on the platform's instruction, not held in the team's own bank account. **(open)**: confirm Omise's marketplace payout setup covers this.
- **Gateway (real launch):** Omise (cards 3.65%, PromptPay 1.65%, both + 7% VAT).
- **Gateway fees (real launch):** paid by the platform out of the commission and escrow fee. Renters always get the full deposit back.

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

| Rule | Code today | Change needed |
|---|---|---|
| Escrow fee `max(30, 3% of deposit)` | Flat `ESCROW_HANDLING_FEE = 30` in `lib/fees.ts` | Make it a function of the deposit |
| Deposit min ฿200 / max ฿3,000, suggested by category | Free input; empty or 0 accepted (`app/sell/page.tsx`) | Add validation and category suggestions |
| Sales: in person, or with protection | Sales are free with no checkout option | Add a "Pay with protection" option |
| Owner payout 48 h after handover | Not modelled | Add when the escrow states are built |
| Late, overdue and missing states | Not modelled | Extend `RentalPhase` |

## Open questions

- How admin approval works for items worth more than ฿6,000.
- Whether Omise's marketplace payouts cover the licence requirement (report only; no gateway is built).
