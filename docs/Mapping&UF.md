# Pass It On (AIT Circular Marketplace)

Buy, Sell & Rent for the AIT Student Community

A closed, calendar-aware, trust-mediated marketplace exclusive to AIT students, enabling students to buy, sell, and rent everyday items. Listing is free; the platform earns where it provides trust: deposit escrow on rentals, optional buyer protection on sales, and premium placement.

**Course:** AST02.21 — E-Business Development and Technology
**Team:** Samichi Rungta · Chidsanuphong Pengchai (Admin) · Lucja Wojtowicz

> **Money rules live in [BusinessRules.md](BusinessRules.md).** Fees, deposits, escrow, payouts and disputes in this file summarise that one; if they ever disagree, BusinessRules.md wins. The routes below are the planned full app; the routes that exist today are listed in [UserFlows.md](UserFlows.md).

---

## Tech Stack

- **Frontend/Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (Postgres, Auth, Storage, Realtime)
- **Deployment:** Vercel
- **Payments:** simulated in the course build, with no payment gateway integration. A real launch would use Omise (PromptPay QR + cards); the "gateway" steps in the flows below are simulated state changes until then.

---

## Table of Contents

1. [Page Mapping](#page-mapping)
2. [Features](#features)
3. [User Flow Diagrams](#user-flow-diagrams)
   - [Seller Perspective — Selling an Item](#seller-perspective--selling-an-item)
   - [Buyer Perspective — Buying an Item](#buyer-perspective--buying-an-item)
   - [Owner Perspective — Renting Out an Item](#owner-perspective--renting-out-an-item)
   - [Renter Perspective — Renting an Item](#renter-perspective--renting-an-item)
4. [Revenue Model](#revenue-model)

---

## Page Mapping

### Public / Marketing
| Route | Purpose |
|---|---|
| `/` | Landing page — value prop, how it works, CTA to sign up |
| `/how-it-works` | Explains buy/sell/rent + calendar-matching + escrow |

### Auth
| Route | Purpose |
|---|---|
| `/login` | Login (Supabase Auth) |
| `/signup` | Signup — restricted to `@ait.asia` domain |
| `/verify-email` | Magic link / OTP confirmation screen |
| `/onboarding` | First-time setup: dorm/pickup location, notification prefs |

### Browse & Discovery
| Route | Purpose |
|---|---|
| `/marketplace` | Main listings grid — filters: category, sale/rent, price, location |
| `/marketplace/[category]` | Category-filtered view (furniture, electronics, etc.) |
| `/listing/[id]` | Listing detail — photos, price, condition, seller info, item history, chat CTA |
| `/search?q=` | Search results |

### Selling / Listing Management
| Route | Purpose |
|---|---|
| `/sell/new` | Create listing (multi-step: Sale/Rent → category → photos → price → deposit for rentals, pre-filled with the category's suggested amount and limited to ฿200–3,000 → condition → pickup location → optional premium placement) |
| `/dashboard/listings` | My listings (active / sold / rented / draft) |
| `/dashboard/listings/[id]/edit` | Edit a listing |
| `/dashboard/listings/[id]/requests` | Incoming buy/rent requests for a listing |

### Pre-Arrival Matching
| Route | Purpose |
|---|---|
| `/needs/new` | Register a pre-arrival need |
| `/dashboard/needs` | My registered needs + auto-matches |
| `/matches` | Calendar-aware suggested matches |

### Transactions
| Route | Purpose |
|---|---|
| `/listing/[id]/checkout` | **Rental:** total = rental fee + 10% commission + escrow fee + deposit. **Sale:** buyer chooses *Pay in person* (free, no escrow) or *Pay with protection* (price + ฿10 + 3%, held in escrow) |
| `/transaction/[id]` | Transaction status page (escrow held, dispute window countdown, pickup/return instructions) |
| `/transaction/[id]/confirm` | Buyer/renter confirms receipt; owner confirms return condition with photos |
| `/dispute/[id]` | Dispute filing/tracking flow |
| `/dashboard/orders` | My purchases & sales history |
| `/dashboard/rentals` | My rentals — as renter and as owner |

### Messaging
| Route | Purpose |
|---|---|
| `/messages` | Inbox |
| `/messages/[conversationId]` | Chat thread tied to a specific listing |

### Profile & Account
| Route | Purpose |
|---|---|
| `/profile/[userId]` | Public profile — ratings, item history, verification badge |
| `/dashboard/profile` | Edit own profile |
| `/dashboard/settings` | Notification prefs, linked AIT email, payment methods |
| `/dashboard/wallet` | Escrow balance, refunded deposits, transaction history, payouts |
| `/dashboard/reviews` | Reviews given/received |

### Notifications
| Route | Purpose |
|---|---|
| `/notifications` | Match alerts, chat pings, dispute-window reminders, return-due and late reminders, seasonal surge alerts |

### Admin (internal, moderation/dispute team)
| Route | Purpose |
|---|---|
| `/admin/dashboard` | Overview stats |
| `/admin/disputes` | Dispute resolution queue (decides deposit splits and refunds) |
| `/admin/users` | User verification/moderation |
| `/admin/listings` | Listing moderation queue, including rental approval for items worth over ~฿6,000 |

---

## Features

**Authentication & Verification**
- AIT email-restricted signup (Supabase Auth, domain-gated magic link/OTP)
- Verification badge on profile
- Campus shops join as partner sellers (`UserKind = 'shop'`) under the same rules

**Listings**
- Create/edit/delete listing (Sale or Rent), always free to list
- Multi-photo upload (Supabase Storage)
- Condition, price, category, pickup location fields
- Rentals: deposit suggested by category, adjustable by the owner within ฿200–3,000 (30–50% of replacement value); a rental can't be published without a deposit
- Draft/active/sold/rented status states

**Search & Discovery**
- Category browsing, keyword search
- Filters: price range, sale vs. rent, pickup location, availability window
- Sort by newest, price, distance

**Pre-Arrival Matching**
- Pre-arrival need registration (item + needed-by date)
- Calendar-aware auto-matching (outgoing listings ↔ incoming needs)
- Seasonal surge highlighting (auto-promote move-out/new-arrival listings near semester dates)

**Transactions & Payments**
- **Rentals always go through the platform.** Renter pays rental fee + 10% commission + escrow fee (`max(฿30, 3% of deposit)`) + refundable deposit.
- **Sales: the buyer chooses.** *Pay in person*: free, paid directly to the seller, no escrow or dispute support. *Pay with protection*: price + ฿10 + 3%, held in escrow.
- The seller/owner always receives their full listing price; platform fees are paid by the buyer/renter on top.
- Payment methods: PromptPay QR (default, cheapest) and cards (for incoming international students without a Thai bank account)
- Gateway fees are absorbed by the platform; deposits are always refunded in full
- Optional premium placement: ฿49 for 7 days

**Escrow & Auto-Release**
- Funds are held by the licensed payment gateway, never by the owner or the team's own bank account
- 48-hour dispute window opens at handover (protected sales) or at return (rentals)
- Rental fee is paid out to the owner 48 hours after handover if no dispute is filed; the deposit stays held until return
- Auto-release when the window closes with no dispute (via scheduled Supabase function)
- Manual early confirmation also releases funds immediately

**Rental-Specific**
- Rental periods: per week, per month, per semester
- Booking request → owner approval → payment → handover
- Return confirmation flow (owner compares photos from handover and return)
- Late return: daily late fee taken from the deposit; more than 7 days late counts as missing and the full deposit goes to the owner

**Trust & Safety**
- Rating system (buyer/seller/renter, post-transaction)
- Item lifecycle/ownership history view
- Dispute filing and resolution workflow with admin review
- Owner can never receive more than the deposit

**Communication**
- In-platform real-time chat (Supabase Realtime), scoped per listing
- Push/email notifications for messages, matches, dispute-window deadlines, return-due dates

**Admin/Moderation**
- Listing moderation queue
- Dispute resolution dashboard
- User verification management

---

## User Flow Diagrams

Rentals and protected sales share one escrow pattern: **payment held → 48-hour dispute window opens at handover/return → auto-release if silent, dispute path if raised.** It is a single reusable mechanism (a scheduled Supabase function checking window expiry). Sales paid in person skip it entirely.

### Seller Perspective — Selling an Item

```mermaid
flowchart TD
    A[Seller logs in] --> B["Create Listing (select 'For Sale')"]
    B --> C[Set price, upload photos, condition, pickup location]
    C --> D[Listing published to marketplace - free to list]
    D --> E{Buyer interested?}
    E -- No --> D
    E -- Yes --> F[Buyer sends chat message]
    F --> G[Negotiate details & confirm pickup time via chat]
    G --> H{How does the buyer pay?}
    H -- Pay in person --> I[Buyer pays seller directly at pickup]
    I --> J[Item handed over - seller marks listing sold]
    J --> Q
    H -- Pay with protection --> K["Buyer pays price + ฿10 + 3% via gateway"]
    K --> L[Payment held in escrow by the gateway]
    L --> M[Item handed over at pickup location]
    M --> N["48-hour dispute window opens"]
    N --> O{Buyer files dispute within window?}
    O -- No dispute - window expires --> P["Funds auto-released: seller gets full price"]
    O -- Buyer confirms early --> P
    P --> Q[Seller and buyer rate each other]
    Q --> R[Item lifecycle updated: new owner recorded]
    O -- Yes, dispute filed --> S[Admin reviews dispute]
    S --> T{Resolved in buyer's favor?}
    T -- Yes --> U[Full or partial refund to buyer]
    T -- No --> P
```

### Buyer Perspective — Buying an Item

```mermaid
flowchart TD
    A[Buyer logs in] --> B[Browse/Search marketplace]
    B --> C[Filter by category, price, location]
    C --> D[View listing detail page]
    D --> E{Interested?}
    E -- No --> B
    E -- Yes --> F[Send chat message to seller]
    F --> G[Negotiate pickup time/logistics via chat]
    G --> H{Choose how to pay}
    H -- Pay in person --> I[Pay seller directly at pickup - free, no protection]
    I --> Q
    H -- Pay with protection --> J["Pay price + ฿10 + 3% via PromptPay or card"]
    J --> K[Payment held in escrow by the gateway]
    K --> L[Meet seller, receive item]
    L --> M["48-hour dispute window opens"]
    M --> N{Item matches listing description?}
    N -- Yes --> O[Buyer confirms receipt - or takes no action and window expires]
    O --> P[Escrow releases payout to seller]
    P --> Q[Buyer rates seller]
    Q --> R[Item added to buyer's owned items - lifecycle updated]
    N -- No --> S[Buyer files dispute with evidence before window closes]
    S --> T[Admin reviews dispute]
    T --> U{Resolved in buyer's favor?}
    U -- Yes --> V[Full or partial refund to buyer]
    U -- No --> P
```

### Owner Perspective — Renting Out an Item

```mermaid
flowchart TD
    A[Owner logs in] --> B["Create Listing (select 'For Rent')"]
    B --> C["Set rental price + period; deposit pre-filled by category (฿200-3,000)"]
    C --> D[Listing published to marketplace]
    D --> E{Renter requests booking?}
    E -- No --> D
    E -- Yes --> F[Renter sends booking request]
    F --> G[Owner approves request]
    G --> H["Renter pays rental fee + 10% + escrow fee + deposit via gateway"]
    H --> I[Funds held in escrow by the gateway]
    I --> J[Item handed over at pickup - handover photos taken]
    J --> K{"Dispute within 48 hrs of handover?"}
    K -- No --> L[Owner receives full rental fee]
    K -- Yes --> X[Admin reviews handover dispute]
    L --> M[Rental period active - deposit still held]
    M --> N{Returned by due date?}
    N -- More than 7 days late --> Y[Counted as missing - full deposit to owner]
    N -- Late, under 7 days --> Z[Daily late fee taken from deposit]
    Z --> O
    N -- On time --> O[Owner checks condition against handover photos]
    O --> P{"Owner files damage claim within 48 hrs?"}
    P -- No claim - window expires --> Q[Remaining deposit refunded to renter]
    P -- Owner confirms good condition --> Q
    Q --> R[Both parties rate each other]
    R --> S[Item history updated]
    P -- Yes, claim filed --> T[Admin reviews photos and chat]
    T --> U{Outcome}
    U -- Normal wear --> Q
    U -- Repairable damage --> V[Repair cost to owner, rest refunded to renter]
    U -- Lost or destroyed --> W[Full deposit to owner]
```

### Renter Perspective — Renting an Item

```mermaid
flowchart TD
    A[Renter logs in] --> B[Browse/Search rentals]
    B --> C[Filter by category, dates, location]
    C --> D["View listing - rental price, fees and deposit shown"]
    D --> E{Interested?}
    E -- No --> B
    E -- Yes --> F[Send booking request to owner]
    F --> G{Owner approves?}
    G -- No --> B
    G -- Yes --> H["Pay rental fee + 10% + escrow fee + deposit (PromptPay or card)"]
    H --> I[Funds held in escrow by the gateway]
    I --> J[Meet owner, receive item]
    J --> K[Use item during rental period]
    K --> L{Returned by due date?}
    L -- Late --> M[Daily late fee taken from deposit]
    M --> N
    L -- On time --> N["48-hour dispute window opens at return"]
    N --> O{Owner raises damage claim within window?}
    O -- No claim - window expires --> P["Remaining deposit refunded to renter"]
    O -- Owner confirms early, good condition --> P
    P --> Q[Renter rates owner]
    O -- Yes, claim filed --> R[Admin reviews dispute]
    R --> S{Outcome}
    S -- Normal wear --> P
    S -- Repairable damage --> T[Repair cost deducted, rest refunded]
    S -- Lost or destroyed --> U[Deposit forfeited to owner]
```

---

## Revenue Model

Full formulas and amounts are in [BusinessRules.md](BusinessRules.md#2-fees).

- **Free to list** — every sale and rental listing is free, keeping the "Facebook group replacement" use case frictionless.
- **Rental commission** — 10% of the rental fee, paid by the renter at booking. Primary revenue stream.
- **Escrow handling fee** — `max(฿30, 3% of deposit)` per rental, paid by the renter, for holding the deposit and running disputes. It scales so gateway fees on large deposits are covered.
- **Buyer protection fee** — ฿10 + 3% on sales where the buyer chooses *Pay with protection*. Sales paid in person stay free.
- **Premium placement** — ฿49 for 7 days at the top of search and matching, for frequent listers.
