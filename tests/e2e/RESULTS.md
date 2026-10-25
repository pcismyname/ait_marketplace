# End-to-end results

Run 2026-10-25 00:03 UTC against http://localhost:3000 (local Supabase, demo accounts from `npm run seed:demo`), headless Microsoft Edge via playwright-core.
Re-run with `npm run test:e2e` (setup notes at the top of [lib.mjs](lib.mjs)). Screenshots go to `tests/e2e/output/` (git-ignored).

| Flow | Result | Steps |
|---|---|---|
| Seller: create listings with a photo; deposit rules (BusinessRules §3) | pass | 12/12 |
| Buyer: in-person sale and protected sale with confirm receipt (§5) | pass | 8/8 |
| Owner + renter: request → approve → pay → handover → payout → return → release; dispute (repairable damage); 48 h auto-release (§4, §6) | pass | 17/17 |
| Late and missing returns (§4) | pass | 7/7 |
| Dead-link crawl as buyer, owner, seller and admin | pass | 4/4 |
| Core pages at 390 px and 1280 px: no horizontal overflow, basic accessibility | pass | 56/56 |

## seller — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | open /sell and choose "For rent" | pass |  |
| 2 | upload a photo (validated and stored in listing-photos) | pass |  |
| 3 | fill title, description, category, condition, price, period, pickup | pass |  |
| 4 | deposit below ฿200 is refused | pass | The deposit must be at least ฿200. |
| 5 | deposit above ฿3,000 is refused | pass | The deposit can be at most ฿3,000. |
| 6 | deposit outside 30–50% of a ฿2,000 replacement value is refused | pass | For an item worth ฿2,000, the deposit must be between ฿600 and ฿1,000. |
| 7 | a ฿800 deposit (40%) is accepted | pass |  |
| 8 | publish → redirected to My Listings with a success toast | pass |  |
| 9 | database row matches the form (deposit, replacement value, photo, period) | pass | ฿150 per month, deposit ฿800, photo image/png |
| 10 | the listing page shows the deposit and the rental quote | pass |  |
| 11 | create a sale listing with a photo (no deposit field) | pass | sale ฿450 |
| 12 | fractional prices are refused (whole baht only) | pass |  |

## buyer — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | in person: listing page → "Buy now" → checkout shows no fee | pass | pending, total ฿300, no escrow |
| 2 | in person: the seller marks it sold from the deal page | pass | completed, listing sold, no ledger rows |
| 3 | protected: checkout shows ฿500 + ฿25 fee = ฿525 | pass | paid ฿525 by card, listing reserved |
| 4 | protected: the seller confirms the handover (48 h window opens) | pass | window closes 2026-10-26T23:58:37.625906+00:00 |
| 5 | protected: the buyer sees the countdown and confirms receipt → released | pass | released, listing sold |
| 6 | protected: the seller is paid the full ฿500 (fee stays with the platform) | pass | seller available +฿500 |
| 7 | protected: the rating dialog opens and saves a review | pass |  |
| 8 | orders page lists both purchases; the in-person one offers "Rate" | pass |  |

## rental — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | renter requests to book from the listing page | pass | requested, quote ฿462 |
| 2 | checkout refuses to take payment before approval | pass |  |
| 3 | owner approves on the listing requests page | pass | approved, listing reserved |
| 4 | renter pays ฿462 = 120 + 12 + 30 + 300 (deposit held) | pass | paid ฿462; renter held balance ฿800 |
| 5 | handover needs a photo; renter confirms it with one → active | pass | due 2026-10-31, payout 48 h after handover |
| 6 | admin fast-forwards 49 h → owner payout of the rental fee | pass | Escrow jobs: 1 payout. · owner +฿120 |
| 7 | owner sees the payout on the rental card | pass |  |
| 8 | renter marks it returned with a photo → 48 h window | pass | return-pending, window 48 h |
| 9 | owner confirms a good return with a photo → deposit refunded in full | pass | released; renter +฿300; listing available |
| 10 | renter rates the owner from the My Rentals card | pass |  |
| 11 | the deal page shows the full timeline and amounts | pass |  |
| 12 | owner files a dispute with a ฿150 repair claim and a photo | pass | dispute 0e23087b… |
| 13 | the renter sees the open dispute | pass |  |
| 14 | admin resolves as repairable damage: ฿150 to the owner, ฿350 refunded | pass | owner +฿150 (claim; rental fee still held until 48 h after handover), renter +฿350 |
| 15 | both parties see the decision | pass |  |
| 16 | returned and unconfirmed: the deposit stays held during the 48 h window | pass |  |
| 17 | admin fast-forwards 49 h → auto-release of the deposit and the owner payout | pass | Escrow jobs: 1 rental deposit released. · renter +฿400 |

## late — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | active weekly rental; admin fast-forwards to 3 days past the due date → overdue | pass | Escrow jobs: 1 payout, 1 overdue. · due 2026-10-22 |
| 2 | renter sees "3 days late · ฿10/day · late fee so far ฿30" | pass |  |
| 3 | renter returns it with a photo → late fee ฿30 fixed | pass | late_days 3, late_fee ฿30 |
| 4 | owner confirms → owner ฿30 from the deposit, renter ฿170 back | pass | owner ฿30, renter ฿170 |
| 5 | admin fast-forwards to 9 days past the due date → missing | pass | Escrow jobs: 1 overdue, 1 missing. |
| 6 | full ฿200 deposit to the owner (capped at the deposit), listing paused | pass | owner +฿270 (deposit + rental fee), listing paused |
| 7 | both sides see "counted as missing" | pass |  |

## links — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | buyer: crawled 29 internal links | pass | 18 route shapes |
| 2 | owner: crawled 37 internal links | pass | 22 route shapes |
| 3 | seller: crawled 32 internal links | pass | 20 route shapes |
| 4 | admin: crawled 30 internal links | pass | 22 route shapes |

## quality — pass

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | 390px login (/login) | pass | scrollWidth 390 = clientWidth 390 |
| 2 | 390px signup (/signup) | pass | scrollWidth 390 = clientWidth 390 |
| 3 | 390px home (/) | pass | scrollWidth 390 = clientWidth 390 |
| 4 | 390px browse (/browse) | pass | scrollWidth 390 = clientWidth 390 |
| 5 | 390px listing-sale (/listing/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 6 | 390px listing-rent (/listing/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 7 | 390px checkout-sale (/listing/:id/checkout) | pass | scrollWidth 390 = clientWidth 390 |
| 8 | 390px sell (/sell) | pass | scrollWidth 390 = clientWidth 390 |
| 9 | 390px my-listings (/my-listings) | pass | scrollWidth 390 = clientWidth 390 |
| 10 | 390px listing-requests (/dashboard/listings/:id/requests) | pass | scrollWidth 390 = clientWidth 390 |
| 11 | 390px rentals-renting (/rentals?view=renting) | pass | scrollWidth 390 = clientWidth 390 |
| 12 | 390px rentals-lending (/rentals?view=lending) | pass | scrollWidth 390 = clientWidth 390 |
| 13 | 390px orders (/dashboard/orders) | pass | scrollWidth 390 = clientWidth 390 |
| 14 | 390px wallet (/dashboard/wallet) | pass | scrollWidth 390 = clientWidth 390 |
| 15 | 390px notifications (/notifications) | pass | scrollWidth 390 = clientWidth 390 |
| 16 | 390px chat (/chat) | pass | scrollWidth 390 = clientWidth 390 |
| 17 | 390px needs (/needs) | pass | scrollWidth 390 = clientWidth 390 |
| 18 | 390px profile (/profile/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 19 | 390px admin-dashboard (/admin/dashboard) | pass | scrollWidth 390 = clientWidth 390 |
| 20 | 390px admin-disputes (/admin/disputes) | pass | scrollWidth 390 = clientWidth 390 |
| 21 | 390px admin-listings (/admin/listings) | pass | scrollWidth 390 = clientWidth 390 |
| 22 | 390px checkout-rent (/listing/:id/checkout?rental=:id) | pass | scrollWidth 390 = clientWidth 390 |
| 23 | 390px transaction-rental (/transaction/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 24 | 390px transaction-sale (/transaction/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 25 | 390px confirm-receipt (/transaction/:id/confirm) | pass | scrollWidth 390 = clientWidth 390 |
| 26 | 390px dispute (/dispute/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 27 | 390px admin-dispute (/admin/disputes/:id) | pass | scrollWidth 390 = clientWidth 390 |
| 28 | 390px keyboard focus is visible (browse, first 6 tab stops) | pass |  |
| 29 | 1280px login (/login) | pass | scrollWidth 1280 = clientWidth 1280 |
| 30 | 1280px signup (/signup) | pass | scrollWidth 1280 = clientWidth 1280 |
| 31 | 1280px home (/) | pass | scrollWidth 1280 = clientWidth 1280 |
| 32 | 1280px browse (/browse) | pass | scrollWidth 1280 = clientWidth 1280 |
| 33 | 1280px listing-sale (/listing/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 34 | 1280px listing-rent (/listing/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 35 | 1280px checkout-sale (/listing/:id/checkout) | pass | scrollWidth 1280 = clientWidth 1280 |
| 36 | 1280px sell (/sell) | pass | scrollWidth 1280 = clientWidth 1280 |
| 37 | 1280px my-listings (/my-listings) | pass | scrollWidth 1280 = clientWidth 1280 |
| 38 | 1280px listing-requests (/dashboard/listings/:id/requests) | pass | scrollWidth 1280 = clientWidth 1280 |
| 39 | 1280px rentals-renting (/rentals?view=renting) | pass | scrollWidth 1280 = clientWidth 1280 |
| 40 | 1280px rentals-lending (/rentals?view=lending) | pass | scrollWidth 1280 = clientWidth 1280 |
| 41 | 1280px orders (/dashboard/orders) | pass | scrollWidth 1280 = clientWidth 1280 |
| 42 | 1280px wallet (/dashboard/wallet) | pass | scrollWidth 1280 = clientWidth 1280 |
| 43 | 1280px notifications (/notifications) | pass | scrollWidth 1280 = clientWidth 1280 |
| 44 | 1280px chat (/chat) | pass | scrollWidth 1280 = clientWidth 1280 |
| 45 | 1280px needs (/needs) | pass | scrollWidth 1280 = clientWidth 1280 |
| 46 | 1280px profile (/profile/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 47 | 1280px admin-dashboard (/admin/dashboard) | pass | scrollWidth 1280 = clientWidth 1280 |
| 48 | 1280px admin-disputes (/admin/disputes) | pass | scrollWidth 1280 = clientWidth 1280 |
| 49 | 1280px admin-listings (/admin/listings) | pass | scrollWidth 1280 = clientWidth 1280 |
| 50 | 1280px checkout-rent (/listing/:id/checkout?rental=:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 51 | 1280px transaction-rental (/transaction/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 52 | 1280px transaction-sale (/transaction/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 53 | 1280px confirm-receipt (/transaction/:id/confirm) | pass | scrollWidth 1280 = clientWidth 1280 |
| 54 | 1280px dispute (/dispute/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 55 | 1280px admin-dispute (/admin/disputes/:id) | pass | scrollWidth 1280 = clientWidth 1280 |
| 56 | 1280px keyboard focus is visible (browse, first 6 tab stops) | pass |  |
