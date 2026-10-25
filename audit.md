# Pass It On — Implementation Audit

**Updated:** 25 October 2026, branch `feat/p0-core` (not yet merged or pushed to production).
Rules: [docs/BusinessRules.md](docs/BusinessRules.md). Database contract: [docs/Database.md](docs/Database.md).
Task list: [action_items.md](action_items.md). Evidence: [tests/e2e/RESULTS.md](tests/e2e/RESULTS.md).

## Tech stack

| Layer | Planned | Current state |
|---|---|---|
| Framework | Next.js App Router | ✅ Next.js 16 App Router, React 19; session refresh in `proxy.ts` (Next 16's name for middleware) |
| Database & auth | Supabase | ✅ Postgres with RLS on every table, Auth (`@ait.asia` enforced by a database trigger), Storage, Realtime, pg_cron |
| Business logic | — | ✅ State machines and money in Postgres functions (`supabase/migrations/`), typed wrappers in `lib/api/`, fees mirrored in `lib/fees.ts` (parity-tested) |
| Styling | — | ✅ Tailwind CSS 4 + shadcn/ui on Base UI ([docs/Design.md](docs/Design.md)) |
| Payments | Gateway in a real launch only | ✅ **Simulated by scope decision** (BusinessRules §7): methods PromptPay / card / wallet are recorded; holds, payouts and refunds are rows in `wallet_ledger`. No gateway, no test mode. |
| Deployment | Vercel | ✅ Live from `master` (pre-P0 schema). The P0 migrations still need `db push` (docs/Database.md §9). |

## Routes

Route names follow the real app (decision 25 Oct): `/browse` (not `/marketplace`), `/sell` (not `/sell/new`), `/chat` (not `/messages`), `/my-listings` for the listing dashboard, `/rentals` for both rental sides.

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | Hero, seasonal banner, categories, featured and recent listings from the database |
| `/browse` (`/search` redirects) | ✅ | Full-text search, URL filters (type, category, condition, pickup, price, sort, seller, favourites), featured first, load more |
| `/listing/[id]` | ✅ | Photos, item history, seller rating; Request to book / Buy now; owner sees request count |
| `/listing/[id]/checkout` | ✅ | Sale: in person or with protection; rent: pays an approved booking only |
| `/sell` | ✅ | Photo upload (validated), deposit rules, replacement value, premium placement (฿49 charged, simulated) |
| `/my-listings` (`/dashboard/listings` redirects) | ✅ | Status tabs; edit, pause, delete, mark sold, requests, view deal; "Hidden by admin" badge |
| `/dashboard/listings/[id]/edit` | ✅ | Saves through the guards; explains deal / history locks |
| `/dashboard/listings/[id]/requests` | ✅ | Approve / decline with reason; renter profile and rating |
| `/rentals` | ✅ | Renting and Lending tabs; every phase with actions, countdowns, late fee so far, photos, rating |
| `/transaction/[id]` | ✅ | Rentals and sales for both parties: timeline, amounts, countdowns, actions, message, rate |
| `/transaction/[id]/confirm` | ✅ | Confirm receipt (sale) or return condition with photos and settlement preview (rental) |
| `/dispute/new`, `/dispute/[id]` | ✅ | File within 48 h with evidence and claim; status, decision, comments (realtime) |
| `/dashboard/orders` | ✅ | Purchases / Sales / Renting / Lending, with "Rate" on closed deals |
| `/dashboard/wallet` | ✅ | Held vs available, protected purchases in escrow, ledger history, simulated withdrawal |
| `/notifications` | ✅ | Realtime, mark read, filters; bell with unread count in the header |
| `/chat` | ✅ | Realtime, one thread per listing per pair, unread counts, no auto-reply |
| `/needs` | ✅ | Needed-by date and type; server-side matching; notification on a new match |
| `/profile/[userId]` | ✅ | Verified AIT badge, rating from reviews, listings |
| `/signup`, `/login`, `/verify-email`, `/reset-password`, `/onboarding` | ✅ | Real auth; guard waits for the session; safe `next` redirects |
| `/dashboard/settings` | ✅ (basic) | Profile summary (edit via onboarding), change password; notification preferences not built (P2) |
| `/how-it-works` | ✅ | Fee explanation |
| `/admin/dashboard`, `/admin/disputes`, `/admin/disputes/[id]`, `/admin/listings`, `/admin/users` | ✅ | Admin-only layout; counters; dispute resolution with §6 outcomes; hide / restore / remove listings; read-only users; demo time travel |
| `/matches`, `/dashboard/profile`, `/dashboard/reviews` | ⏸ P2 | Matches show on `/needs`; profile editing is `/onboarding` |
| Terms / Privacy pages, footer | ❌ P1 | Not started |

## Business rules coverage

See the "Current code vs. these rules" table at the end of [docs/BusinessRules.md](docs/BusinessRules.md). Every decided rule is implemented server-side; the open ones (admin approval for items over ~฿6,000, refunds for a paid deal cancelled before handover) are placeholders only.

## Verification (25 Oct 2026)

| Check | Result |
|---|---|
| `npm test` (fee unit tests) | 18 / 18 pass |
| `npm run test:db` (server vs client fee parity) | 5 / 5 pass |
| `npx supabase test db` (pgTAP) | 304 / 304 pass, on an empty database and after `npm run seed:demo` |
| `npx tsc --noEmit` | clean |
| ESLint | 0 errors, 0 warnings (master: 27 errors) |
| `next build` (production env) | passes |
| `npm run test:e2e` | seller, buyer, owner + renter (dispute, auto-release), late / missing, link crawl (4 roles), 390 / 1280 px quality pass — all pass ([RESULTS.md](tests/e2e/RESULTS.md)) |

## Known gaps

Tracked in [action_items.md §2.12](action_items.md): production migration and live re-test, two team decisions for BusinessRules (sale "as described" outcome and protection-fee refund; refunds for paid deals cancelled before handover), return photos enforced only in the UI, listing delete cascades chat threads, orphaned uploads when an RPC is refused, every signed-in user can read user emails, Lighthouse run.
