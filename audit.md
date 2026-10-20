# AIT Circular Marketplace — Implementation Audit

## Tech Stack (as designed)
| Layer | Planned | Current State |
|---|---|---|
| Framework | Next.js App Router | ✅ Next.js App Router |
| Database & Auth | Supabase | ❌ Not connected — all data is **mock/in-memory** |
| Styling | (not specified) | ✅ Tailwind CSS + shadcn/ui |
| Payments | Omise / 2C2P | ❌ Not connected — checkout is **simulated** |
| Deployment | Vercel | Not evaluated |

---

## Routes Implemented vs. Planned

### ✅ Implemented (6 pages + components)

| Route (Planned) | Actual File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Landing: hero, seasonal banner, category grid, featured + recent listings, why section |
| `/browse` | `app/browse/page.tsx` | Full grid with search, category filter, type (sale/rent) filter, sort |
| `/listing/[id]` | `app/listing/[id]/page.tsx` | Listing detail: photos, price+commission, condition, seller, reviews, item history, chat CTA, rent checkout dialog |
| `/sell` | `app/sell/page.tsx` | Multi-step create listing: type → category → photos → price/deposit → condition → pickup → premium placement |
| `/chat` | `app/chat/page.tsx` | Messaging inbox + thread view, canned replies, simulated seller auto-reply |
| `/needs` | `app/needs/page.tsx` | Pre-arrival need registration form + auto-match display against available listings |
| `/rentals` | `app/rentals/page.tsx` | Rental dashboard (renter POV): active/return-pending/released/disputed phases, phase transitions |

### ❌ Not Implemented (from Mapping&UF.md)

**Auth**
- `/login`, `/signup`, `/verify-email`, `/onboarding` — no auth at all, current user is hardcoded (`CURRENT_USER_ID = 'u_me'`)

**Browse & Discovery**
- `/marketplace` (the mapping uses `/marketplace`, app uses `/browse` — minor naming mismatch)
- `/marketplace/[category]` — category sub-routes not implemented (handled via query params on `/browse`)
- `/search?q=` — search is embedded in `/browse`, no dedicated `/search` route

**Selling / Listing Management**
- `/sell/new` — exists as `/sell` (name mismatch)
- `/dashboard/listings` — no dashboard, no listing management UI
- `/dashboard/listings/[id]/edit` — not implemented
- `/dashboard/listings/[id]/requests` — not implemented (incoming buy/rent requests)

**Pre-Arrival**
- `/matches` — not implemented (needs/matches exist on `/needs` but no dedicated matches page)

**Transactions**
- `/listing/[id]/checkout` — checkout is a **dialog** on the listing page, not a full route
- `/transaction/[id]` — not implemented (transaction status/escrow page)
- `/transaction/[id]/confirm` — not implemented
- `/dispute/[id]` — not implemented
- `/dashboard/orders` — not implemented
- `/dashboard/rentals` — exists as `/rentals` (name mismatch, seller POV missing)

**Messaging**
- `/messages` / `/messages/[conversationId]` — exists as `/chat` (route name mismatch)

**Profile & Account**
- `/profile/[userId]` — not implemented (public profile page)
- `/dashboard/profile` — not implemented
- `/dashboard/settings` — not implemented
- `/dashboard/wallet` — not implemented
- `/dashboard/reviews` — not implemented

**Notifications**
- `/notifications` — not implemented

**Admin**
- `/admin/dashboard`, `/admin/disputes`, `/admin/users`, `/admin/listings` — none implemented

---

## What's Working (Functional Logic)

| Feature | Status | Notes |
|---|---|---|
| Mock data layer | ✅ | `lib/data.ts` — seeded users, listings, needs, rentals, threads |
| Type system | ✅ | `lib/types.ts` — full domain model |
| Global state (React Context) | ✅ | `lib/store.tsx` — addListing, addNeed, startRental, setRentalPhase, thread/messaging actions |
| Fee calculation | ✅ | `lib/fees.ts` — 10% commission, deposit logic, rental quote |
| Seasonal detection | ✅ | `lib/seasons.ts` — semester-aware surge alerts |
| Create listing flow | ✅ | Multi-step form, photo upload (local preview), premium placement toggle |
| Browse + filter + sort | ✅ | Category, sale/rent type, keyword search, sort by price/recent |
| Listing detail page | ✅ | Photos, price+commission breakdown, condition, seller info, item history, reviews |
| Rent checkout dialog | ✅ | Quote preview (deposit + commission), payment method, confirmation |
| Rental phase management | ✅ | Active → return-pending → released / disputed transitions |
| Chat / messaging | ✅ | Thread list, message send, simulated canned auto-reply |
| Pre-arrival needs | ✅ | Register need, auto-match to available listings |
| Seasonal banner | ✅ | Shows move-out/new-arrival alerts near semester dates |

---

## Key Gaps / What Needs to Be Done Next

### Priority 1 — Auth (Blocker for everything else)
- Supabase Auth integration with `@ait.asia` domain gate
- Login / Signup / Email verification pages
- Onboarding flow (dorm/pickup location selection)
- Replace hardcoded `CURRENT_USER_ID` with real session user

### Priority 2 — Dashboard & Account
- `/dashboard/listings` — manage own listings (active, sold, rented, drafts)
- `/dashboard/listings/[id]/edit` — edit listing form
- `/dashboard/listings/[id]/requests` — incoming buy/rent requests
- `/dashboard/orders` — purchase history
- `/dashboard/rentals` — full rental view (both sides: renter + owner)
- `/dashboard/wallet` — escrow balance, payouts
- `/dashboard/settings` — notification prefs, payment methods

### Priority 3 — Transaction Flow
- `/listing/[id]/checkout` — full page checkout (not just a dialog)
- `/transaction/[id]` — escrow status, dispute window countdown, pickup instructions
- `/transaction/[id]/confirm` — confirm receipt / return condition
- `/dispute/[id]` — dispute filing + tracking

### Priority 4 — Public Profile
- `/profile/[userId]` — public profile with rating, verification badge, listing history

### Priority 5 — Backend Integration
- Connect Supabase: replace mock `lib/data.ts` with real DB queries
- Replace photo upload (currently local `URL.createObjectURL`) with Supabase Storage
- Real-time chat via Supabase Realtime (currently simulated)
- Payment gateway (Omise / 2C2P) for actual checkout

### Priority 6 — Notifications & Admin
- `/notifications` page
- `/admin/*` dashboard, disputes, users, listings moderation

### Minor / Polish
- Route name alignment: `/sell` → `/sell/new`, `/browse` → `/marketplace`, `/chat` → `/messages`
- `/how-it-works` marketing page (currently absent)
- `/search?q=` dedicated search results route
- Seller POV on rentals dashboard (currently only renter view)
