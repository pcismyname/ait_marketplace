# AIT Circular Marketplace

Buy, Sell & Rent for the AIT Student Community

A closed, calendar-aware, trust-mediated marketplace exclusive to AIT students, enabling students to buy, sell, and rent everyday items — with platform-mediated escrow and commission on every transaction.

**Course:** AST02.21 — E-Business Development and Technology
**Team:** Samichi Rungta · Chidsanuphong Pengchai (Admin) · Lucja Wojtowicz

---

## Tech Stack

- **Frontend/Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (Postgres, Auth, Storage, Realtime)
- **Deployment:** Vercel
- **Payments:** Omise / 2C2P (Thailand-compatible payment gateway)

---

## Table of Contents

1. [Page Mapping](#page-mapping)
2. [Features](#features)
3. [User Flow Diagrams](#user-flow-diagrams)
   - [Seller Perspective — Selling an Item](#seller-perspective--selling-an-item)
   - [Buyer Perspective — Buying an Item](#buyer-perspective--buying-an-item)
   - [Owner Perspective — Renting Out an Item](#owner-perspective--renting-out-an-item)
   - [Renter Perspective — Renting an Item](#renter-perspective--renting-an-item)

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
| `/sell/new` | Create listing (multi-step: Sale/Rent → category → photos → price/deposit → condition → pickup location) |
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
| `/listing/[id]/checkout` | Checkout for both sales and rentals — total = listing price + 10% commission (+ deposit for rentals) |
| `/transaction/[id]` | Transaction status page (escrow held, dispute window countdown, pickup/return instructions) |
| `/transaction/[id]/confirm` | Buyer/renter confirms receipt or return condition |
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
| `/dashboard/wallet` | Escrow balance, transaction history, payouts |
| `/dashboard/reviews` | Reviews given/received |

### Notifications
| Route | Purpose |
|---|---|
| `/notifications` | Match alerts, chat pings, dispute-window reminders, seasonal surge alerts |

### Admin (internal, moderation/dispute team)
| Route | Purpose |
|---|---|
| `/admin/dashboard` | Overview stats |
| `/admin/disputes` | Dispute resolution queue |
| `/admin/users` | User verification/moderation |
| `/admin/listings` | Listing moderation queue |

---

## Features

**Authentication & Verification**
- AIT email-restricted signup (Supabase Auth, domain-gated magic link/OTP)
- Verification badge on profile

**Listings**
- Create/edit/delete listing (Sale or Rent)
- Multi-photo upload (Supabase Storage)
- Condition, price/deposit, category, pickup location fields
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
- All transactions (sales **and** rentals) route through the platform payment gateway — no in-person cash exchange
- 10% platform commission on every transaction: buyer/renter pays listing price + commission; seller/owner receives the listing price
- Escrow holding for all payments until handover/return is confirmed
- Optional premium placement fee for frequent listers

**Escrow & Auto-Release**
- Funds held in escrow from checkout until a dispute window closes
- 24–48 hour dispute window opens at handover (sales) or return (rentals)
- Auto-release to seller/owner if no dispute is filed within the window (via scheduled Supabase function)
- Manual early confirmation also releases funds immediately

**Rental-Specific**
- Booking request → owner approval flow
- Deposit hold and scheduled release alongside rental fee
- Return confirmation flow (photo-based condition check)

**Trust & Safety**
- Rating system (buyer/seller/renter, post-transaction)
- Item lifecycle/ownership history view
- Dispute filing and resolution workflow with admin review

**Communication**
- In-platform real-time chat (Supabase Realtime), scoped per listing
- Push/email notifications for messages, matches, dispute-window deadlines

**Admin/Moderation**
- Listing moderation queue
- Dispute resolution dashboard
- User verification management

---

## User Flow Diagrams

All four flows share the same escrow pattern: **payment held → dispute window opens at handover/return → auto-release if silent, dispute path if raised.** This is a single reusable mechanism (a scheduled Supabase function checking window expiry) applied consistently across sale and rental transaction types.

### Seller Perspective — Selling an Item

```mermaid
flowchart TD
    A[Seller logs in] --> B["Create Listing (select 'For Sale')"]
    B --> C[Set listing price, upload photos, condition, pickup location]
    C --> D["Platform calculates buyer price = listing price + 10% commission"]
    D --> E[Listing published to marketplace]
    E --> F{Buyer interested?}
    F -- No --> E
    F -- Yes --> G[Buyer sends chat message]
    G --> H[Negotiate details & confirm pickup time via chat]
    H --> I[Buyer proceeds to checkout and pays total price]
    I --> J[Payment held in escrow by platform]
    J --> K[Seller and buyer meet at pickup location]
    K --> L[Item handed over to buyer]
    L --> M["Return/dispute window opens (24-48 hrs)"]
    M --> N{Buyer files dispute within window?}
    N -- No dispute filed - window expires --> O["Funds auto-released: seller gets listing price"]
    N -- Buyer confirms early --> O
    O --> P["Platform retains 10% commission"]
    P --> Q[Seller rates buyer]
    Q --> R[Buyer rates seller]
    R --> S[Item lifecycle updated: new owner recorded]
    N -- Yes, dispute filed --> T[Platform reviews dispute]
    T --> U{Resolved in buyer's favor?}
    U -- Yes --> V[Full or partial refund to buyer]
    U -- No --> O
```

### Buyer Perspective — Buying an Item

```mermaid
flowchart TD
    A[Buyer logs in] --> B[Browse/Search marketplace]
    B --> C[Filter by category, price, location]
    C --> D["View listing detail page (shows price + commission = total)"]
    D --> E{Interested?}
    E -- No --> B
    E -- Yes --> F[Send chat message to seller]
    F --> G[Negotiate pickup time/logistics via chat]
    G --> H[Proceed to checkout]
    H --> I["Pay total price (listing price + 10% commission) via payment gateway"]
    I --> J[Payment held in escrow by platform]
    J --> K[Meet seller at agreed pickup location]
    K --> L[Receive item from seller]
    L --> M["Return/dispute window opens (24-48 hrs)"]
    M --> N{Item matches listing description?}
    N -- Yes --> O[Buyer confirms receipt - or takes no action and window expires]
    O --> P[Escrow releases payout to seller]
    P --> Q[Buyer rates seller]
    Q --> R[Item added to buyer's owned items - lifecycle updated]
    N -- No --> S[Buyer files dispute with evidence before window closes]
    S --> T[Platform reviews dispute]
    T --> U{Resolved in buyer's favor?}
    U -- Yes --> V[Refund issued to buyer]
    U -- No --> P
```

### Owner Perspective — Renting Out an Item

```mermaid
flowchart TD
    A[Owner logs in] --> B["Create Listing (select 'For Rent')"]
    B --> C[Set rental price + deposit, condition, pickup location]
    C --> D[Listing published to marketplace]
    D --> E{Renter requests booking?}
    E -- No --> D
    E -- Yes --> F[Renter sends booking request]
    F --> G[Owner approves request]
    G --> H[Platform collects rental fee + deposit via payment gateway]
    H --> I[Funds held in escrow]
    I --> J[Item handed over at pickup]
    J --> K[Rental period active]
    K --> L[Renter returns item at/before due date]
    L --> M["Return dispute window opens (24-48 hrs)"]
    M --> N{Owner files damage dispute within window?}
    N -- No dispute filed - window expires --> O["Funds auto-released: deposit refunded to renter, rental fee minus commission paid to owner"]
    N -- Owner confirms early, good condition --> O
    O --> P[Both parties rate each other]
    P --> Q[Item history updated]
    N -- Yes, dispute filed --> R[Owner files dispute with evidence before window closes]
    R --> S[Platform reviews dispute]
    S --> T{Resolved in owner's favor?}
    T -- Yes --> U[Deposit partially/fully released to owner]
    T -- No --> O
```

### Renter Perspective — Renting an Item

```mermaid
flowchart TD
    A[Renter logs in] --> B[Browse/Search rentals]
    B --> C[Filter by category, dates, location]
    C --> D[View listing - rental price + deposit shown]
    D --> E{Interested?}
    E -- No --> B
    E -- Yes --> F[Send booking request to owner]
    F --> G{Owner approves?}
    G -- No --> B
    G -- Yes --> H[Pay rental fee + deposit online]
    H --> I[Funds held in escrow]
    I --> J[Meet owner, receive item]
    J --> K[Use item during rental period]
    K --> L[Return item before due date]
    L --> M["Return dispute window opens (24-48 hrs)"]
    M --> N{Owner raises damage dispute within window?}
    N -- No dispute filed - window expires --> O["Deposit auto-refunded to renter"]
    N -- Owner confirms early, good condition --> O
    O --> P[Renter rates owner]
    N -- Yes, dispute filed --> Q[Dispute process initiated]
    Q --> R{Resolved?}
    R -- Renter's favor --> O
    R -- Owner's favor --> S[Deposit forfeited to owner per resolution]
```

---

## Revenue Model

- **10% platform commission on every transaction** — both sales and rentals. Buyer/renter pays listing price + commission; seller/owner receives the listing price.
- **Escrow/deposit handling** — built into the commission-bearing transaction flow for rentals (deposit held and released alongside the rental fee).
- **Optional premium placement** — frequent listers can pay a small fee for better visibility in search/matching results.
