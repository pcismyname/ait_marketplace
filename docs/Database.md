# Pass It On — Database and API contract

**Owns:** the Supabase schema, the rental and sale state machines as built, every RPC, Row Level Security, storage paths, and how to run, test and deploy the database.
**Follows:** [BusinessRules.md](BusinessRules.md) for every money rule. If this file and BusinessRules.md disagree, BusinessRules.md wins: fix the SQL.

Schema: [`supabase/migrations/`](../supabase/migrations/) (`20261025000000_remote_baseline.sql` is the live schema before P0; `20261025010000_p0_core.sql` adds everything below, the `20261025020…` files add features, and `20261025030000_review_fixes.sql` applies the final-review fixes listed in section 4.1). Client wrappers: [`lib/api/`](../lib/api/). Tests: [`supabase/tests/`](../supabase/tests/) and [`lib/fees.db.test.ts`](../lib/fees.db.test.ts).

**All money is simulated** (BusinessRules §7). Payments, escrow holds, payouts and refunds are rows in `wallet_ledger` plus state changes. There is no gateway and no test mode.

---

## 1. Ground rules for app code

1. **Never write money or state directly.** `rentals`, `transactions`, `disputes`, `wallet_ledger`, `threads`, `thread_participants` and `reviews` are read-only for clients. Every change goes through an RPC (section 4), and the client wrappers are in `lib/api`.
2. **Import from `@/lib/api`** in client components (`import { payRental } from '@/lib/api'`). Every function throws `ApiError`, whose `message` is written for users and can go straight into a toast.
3. **Fees in the UI come from `lib/fees.ts`**, and the server computes the same numbers (`quote_rental`, `quote_sale`; parity is tested). The server never trusts a client total.
4. **IDs are text** (UUID strings) everywhere, like the baseline. `auth.uid()::text = users.id`.
5. **Notifications link to `/transaction/<id>`** for both rentals and sales. Resolve the id with `getDeal(id)` from `lib/api/deals.ts`. Owner booking requests link to `/dashboard/listings/<listingId>/requests`, disputes to `/dispute/<disputeId>`, chat to `/chat?thread=<threadId>`, pre-arrival matches (`need_match`) to `/listing/<listingId>`.

---

## 2. Tables

| Table | What | Who reads (RLS) | Who writes |
|---|---|---|---|
| `users` | Profile per auth user (auto-created at signup). `is_admin`, `pickup_location`, `role_intents`, `arrival_date`, `departure_date`, `onboarded_at` added. | Signed-in users | Owner of the row. `is_admin`, `rating`, `reviews_count` are ignored from clients (trigger). The `email` always mirrors the auth email. |
| `listings` | Items for sale or rent. Adds `replacement_value`, `featured_until`, `updated_at`, and `search` (a generated tsvector). | Everyone, logged out too | Seller (insert, update, delete); admins (update, delete). Guarded, see below. |
| `listing_history` | Item history ("Bought in person", …) | Everyone | The RPCs append to it. A seller may insert only the first row of their own new listing (`Listed on …`, under their own name); nobody edits or deletes rows from the client. |
| `reviews` | Adds `subject_id` (the reviewed user), `rental_id`, `transaction_id`; role can be `owner` | Everyone | `submit_review` only |
| `needs` | Pre-arrival requests. `needed_by` (date) and `listing_type` (`any` / `sale` / `rent`) added by `20261025020500_needs_matching.sql`; a trigger fills `needed_by` from legacy free-text `arrival_date` (`'August 2026'` → 2026-08-01). | Signed-in users | Own rows (insert, update, delete) |
| `favorites` | Saved listings | Own rows | Own rows |
| `threads` · `thread_participants` · `messages` | Chat. `threads.created_by`, `thread_participants.last_read_at` added. | Participants and admins (admins need the chat history for disputes) | `start_thread` creates threads and participants. Participants insert messages. Messages can't be edited (they are dispute evidence). |
| `rentals` | Rental bookings (section 3.1) | Renter, owner, admins | RPCs only |
| `transactions` | Sales, in person and protected (section 3.2) | Buyer, seller, admins | RPCs only |
| `disputes` | One open dispute per rental or sale | The parties and admins | `file_dispute`, `resolve_dispute` |
| `dispute_comments` | Discussion on a dispute | The parties and admins | The parties and admins insert while the dispute is open |
| `wallet_ledger` | Simulated money movements (section 5) | Own rows; admins see all, including platform revenue | RPCs only |
| `notifications` | In-app notifications | Own rows | The server. Clients may only set `read_at` or delete their own. |

### Listing guard (`listings_guard` trigger, clients only)

- The seller of a listing can't be changed.
- A rental needs a deposit of ฿200–฿3,000 (§3), and the price must be above ฿0. This is checked on insert and whenever type, price or deposit change.
- A new listing starts as `available` or `paused`.
- `rented` is set only by `pay_rental`. While a booking (`approved` … `overdue`) or a protected sale (`paid`, `handed-over`, `disputed`) is in progress, the status can't be changed by hand.
- A listing with rental or sale history can't be deleted; pause it instead.
- `times_changed_hands` and `view_count` are server-kept (`listings_client_fields_guard`): a client insert starts at 1 and 0, and a client update that changes either is refused.
- When `replacement_value` is set on a rental, the deposit must be 30–50% of it, clamped to ฿200–฿3,000 (same numbers as `depositRangeForValue` in `lib/fees.ts`; checked on insert and whenever type, deposit or value change).

### Premium placement, type lock, whole baht (`listings_premium_type_guard` trigger, clients only)

Migration `20261025020401_premium_placement.sql`:

- Clients can't write `featured` or `featured_until`. A client insert always starts unfeatured; an update that changes either is refused. Premium placement goes through `enable_premium_placement` / `end_premium_placement` (section 4). Rows with `featured = true` and no `featured_until` can only come from SQL or the seed script, and count as featured with no end date (legacy).
- The type (`sale` ↔ `rent`) can't change while a rental is `requested`, an in-person purchase is `pending`, or a deal is in progress (`respond_rental` and `mark_sold` don't re-check the type).
- Price and deposit must be whole baht when they are written (insert, or when they change).
- Deleting a listing cascades to its pending requests, purchase intents and chat threads. The `listings_notify_deleted` trigger (before delete) sends each other student involved one `listing_removed` notification. If the delete is refused, the notifications roll back with it.

Tested in `supabase/tests/20261025020401_premium_placement.test.sql`.

### Admin moderation (`listings_moderation_guard` trigger, clients only)

`listings.hidden_at`, `hidden_by`, `hidden_reason` (migration `20261025020300_admin_moderation.sql`) are set only by admins, through `admin_moderate_listing`. A hidden listing is `paused`, and its seller can't change its status (relist it) or clear the flag until an admin restores it; other edits still work. Non-admin inserts get the columns nulled. Hidden listings stay publicly readable (they are just `paused`). Tested in `supabase/tests/20261025020300_admin_moderation.test.sql`.

### Browse and search

The table has indexes on `category`, `type`, `status`, `created_at desc` and `seller_id`, plus a GIN index on `search`. The search vector weights the title as A, the description as B, and the category and pickup location as C. `searchListings({ q, category, type, status, sort, … })` in `lib/api/listings.ts` uses web-search syntax (`desk -broken "mini fridge"`).

- `searchListingsPage(search)` returns `{ listings, total }` (exact count) for "N items" and "Load more". Extra filters: `condition`, `pickupLocation`, `statuses` (several at once), `ids` (favourites; an empty list matches nothing). `match: 'prefix'` matches the start of each word for search as you type (`fri` finds "fridge"); text with quotes, `-` or `or` still uses web-search syntax.
- **Featured first** (`20261025020400_listing_featured_rank.sql`): `public.is_featured(listings)` is a PostgREST computed field, true while `featured` is set and `featured_until` is empty (legacy rows) or in the future. Both search helpers order by `is_featured desc`, then the chosen sort, then `id` (stable pages). `mapListing` sets `Listing.featured` from the same rule. Tested in `supabase/tests/20261025020400_listing_featured.test.sql`.
- The app's browse (`/`, `/browse`, `/search` redirects there) shows `available`, `reserved` and `rented` listings; the URL query string (`q`, `type`, `category`, `condition`, `location`, `min`, `max`, `sort`, `seller`, `favorites=1`) is the source of truth.

---

## 3. State machines

### 3.1 Rentals (`rentals.phase`, BusinessRules §4)

```
             respond_rental(false)                cancel_rental
requested ───────────────────────► declined   requested/approved ──► cancelled
    │ respond_rental(true)
    ▼
approved ── pay_rental ──► paid ── confirm_handover ──► active ──(due date passes, job)──► overdue
                                                          │                                 │ (> 7 days late, job)
                                                          │ mark_returned / confirm_return  ▼
                                                          ▼                               missing  (full deposit to owner)
                                                    return-pending ──(owner confirms, or 48 h with no dispute)──► released
                                                          │ file_dispute (within 48 h)
                                                          ▼
                                                      disputed ── resolve_dispute (admin) ──► resolved
```

`overdue` also goes to `return-pending` through `mark_returned`. `declined` and `cancelled` are clarifications of §4 (states, not money rules): a request the owner turns down, or a booking dropped before payment.

| Column | Set when |
|---|---|
| `requested_at`, `quote`, `rental_fee`, `commission`, `escrow_fee`, `period_days`, `rental_period` | `request_rental` (the quote is a snapshot; later listing edits don't change it) |
| `approved_at` / `declined_at` (+ `decline_reason`) / `cancelled_at` (+ `cancelled_by`) | respond / cancel |
| `paid_at`, `payment_method`, `total_paid` | `pay_rental` |
| `handover_at`, `start_date`, `due_date` = handover + period, `payout_at` = handover + 48 h | `confirm_handover`. Before handover, `start_date` / `due_date` are provisional (request time + period). |
| `payout_released_at` | Owner's rental fee paid out (job, 48 h after handover) |
| `overdue_at` | Job, when the due date has passed |
| `returned_at`, `dispute_window_ends_at` = return + 48 h, `late_days`, `late_fee` | `mark_returned` (or `confirm_return` from active / overdue) |
| `released_at`, `deposit_to_owner`, `deposit_to_renter` | Deposit settled: released, resolved or missing |
| `handover_photos`, `return_photos` | Storage paths (section 7) |

Money rules applied:

- **Late fee** = `ceil(rental_fee / period_days)` per day late (part days count), taken from the deposit and capped at it. It is fixed at the return.
- **Missing** = more than 7 days late. The full deposit goes to the owner and the listing is paused.
- **Owner payout**: the rental fee is released 48 h after handover, unless the rental is `disputed` at that moment (then it's paid when the dispute is resolved). A dispute resolved before `payout_at` doesn't bring the payout forward: the job pays `resolved` rentals at `payout_at`. The deposit is untouched until the return.
- **Handover**: only the renter confirms it (`confirm_handover`), with at least one photo; `mark_returned` and `confirm_return` also need one (photos already on the rental count for `confirm_return`). Photo paths must be uploaded objects under `dispute-evidence/rental/<id>/`.
- **Release** (owner confirms, or the window closes with no dispute): the owner gets `late_fee`, and the renter gets `deposit − late_fee`. The listing goes back to `available`.
- **Dispute resolution**: the owner gets `min(deposit, late_fee + claim)`. The claim is ฿0 for normal wear, the repair cost for repairable damage (must be ≤ deposit, or the RPC refuses), and the full deposit for lost or destroyed.

### 3.2 Sales (`transactions.status`, BusinessRules §5)

```
in person:  create_sale(in-person) ──► pending ── mark_sold (seller) ──► completed
                                          └── cancel_sale (either) ──► cancelled
            mark_sold(listing, buyer) needs that buyer's pending purchase; without a buyer it records a completed sale with no buyer.

protected:  create_sale(protected, method) ──► paid ── confirm_sale_handover (either) ──► handed-over
                                                 │                                          │ 48 h, no dispute (job)
                                                 │ confirm_sale_receipt (buyer)              │ or confirm_sale_receipt
                                                 └──────────────────────────────────────────►├──► released
                                                                       file_dispute (buyer, ≤ 48 h)
                                                                                            ▼
                                                                         disputed ── resolve_dispute ──► resolved
```

- In-person sales never touch the ledger and have no disputes. An in-person intent doesn't reserve the listing. `mark_sold` completes the chosen buyer's pending purchase and cancels the others (each gets a notification). A buyer id without a pending purchase is refused, so a seller can't record a sale to (and then review) a student who never asked to buy.
- Protected: on payment the price is held for the seller, the protection fee goes to the platform, and the listing becomes `reserved`. On release the seller gets the price and the listing becomes `sold` (`times_changed_hands + 1`, plus a history row); other buyers' pending in-person purchases are cancelled and those buyers notified.
- Resolution for sales: `not-as-described` refunds `amount` (default: the full price, capped at the price) to the buyer's wallet, and the seller gets the rest. A full refund pauses the listing instead of marking it sold. `normal-wear` rejects the claim, and the seller is paid in full. The protection fee is not refunded.

### 3.3 Pre-arrival matching (`20261025020500_needs_matching.sql`)

A need matches a listing when the listing is `available` (paused, hidden, reserved, rented and sold listings never match), the category is the same, the type fits (`needs.listing_type` is `any` or equals `listings.type`), the listing isn't the need owner's own, and the need is **open**: no `needed_by`, or `needed_by` at most 30 days ago (`private.need_is_open`; students keep looking in their first month). The rule lives once in `private.need_matches_listing` and is used by `match_needs` and by the trigger below. BusinessRules §9: matches are held until the student arrives, so there is no lower bound on how early a match can show.

`listings_notify_need_matches` (after insert, or an update of status / category / type that leaves the listing `available`) sends the owner of every open matching need one notification, kind `need_match`, linking to `/listing/<id>`, deduplicated per need and listing (`match:<need>:<listing>`), so a listing that comes back to `available` doesn't notify twice. Client wrappers: `lib/api/needs.ts` (`listNeeds`, `createNeed`, `updateNeedDate`, `deleteNeed`, `matchNeeds`, `isNeedOpen`).

---

## 4. RPCs (all `SECURITY DEFINER`, `search_path = public`)

Each RPC checks `auth.uid()`, locks the row, validates the from-state and raises a clear message on refusal (`P0001`). Wrappers are in `lib/api/*` (camelCase names). "Either" means either party of that deal.

| RPC (args) | Caller | From → to | Side effects |
|---|---|---|---|
| `quote_rental(p_price, p_deposit?)` → jsonb `RentalQuote` | anyone (anon too) | — (pure) | — |
| `quote_sale(p_price, p_mode)` → jsonb `SaleQuote` | anyone | — (pure) | — |
| `request_rental(p_listing_id, p_message?)` → rentals | renter (not the owner) | listing `available`, valid deposit → `requested` | Quote stored; owner notified |
| `respond_rental(p_rental_id, p_approve, p_reason?)` | owner | `requested` → `approved` / `declined` | Approve: listing `reserved` (only one approved booking per item). Renter notified |
| `cancel_rental(p_rental_id, p_reason?)` | either | `requested` / `approved` → `cancelled` | Listing back to `available` if it was reserved; other party notified |
| `pay_rental(p_rental_id, p_method)` | renter | `approved` → `paid` | Ledger: payment −total; deposit held (renter); rental fee held (owner); commission and escrow fee to the platform. Listing `rented`; other `requested` bookings declined. `wallet` needs enough available balance. |
| `confirm_handover(p_rental_id, p_photos)` | renter | `paid` → `active` | Needs ≥ 1 photo. Due date and payout time start; owner notified |
| `mark_returned(p_rental_id, p_photos)` | either | `active` / `overdue` → `return-pending` (or `missing` if more than 7 days late) | Needs ≥ 1 photo. Late fee fixed; 48 h window opens; other party notified |
| `confirm_return(p_rental_id, p_photos?)` | owner | `return-pending` (or `active` / `overdue`, which records the return first) → `released` | Needs ≥ 1 return photo (either party's). Deposit settled (owner: late fee; renter: the rest); listing `available`; payout if due |
| `create_sale(p_listing_id, p_mode, p_method?)` → transactions | buyer (not the seller) | listing `available` → `pending` (in person) / `paid` (protected) | Protected: ledger payment, price held, fee to the platform, listing `reserved`. Seller notified |
| `confirm_sale_handover(p_transaction_id, p_photos?)` | either | `paid` → `handed-over` | 48 h window; buyer notified |
| `confirm_sale_receipt(p_transaction_id)` | buyer | `paid` / `handed-over` → `released` | Seller paid now; listing `sold` |
| `mark_sold(p_listing_id, p_buyer_id?)` | seller | sale listing, no protected sale open → `completed` | `p_buyer_id` must have a pending in-person purchase. Listing `sold`; other pending purchases cancelled |
| `cancel_sale(p_transaction_id)` | either | `pending` → `cancelled` | Other party notified. Protected purchases can't be cancelled. |
| `file_dispute(p_reason, p_description?, p_rental_id?, p_transaction_id?, p_evidence?, p_claim_amount?)` → disputes | rental: either party; sale: buyer | rental `return-pending` / sale `handed-over`, before `dispute_window_ends_at` → `disputed` | Evidence paths must be under `rental/<id>/` or `sale/<id>/`; claim is whole baht, ≥ 0 and ≤ deposit / price. Other party and all admins notified |
| `resolve_dispute(p_dispute_id, p_finding, p_amount?, p_note?)` → disputes | admin | dispute `open` → `resolved`; deal → `resolved` | Amount is whole baht. Settlement per §3 above; ledger rows carry `dispute_id`; both parties notified |
| `run_escrow_jobs()` → jsonb counts | any signed-in user, pg_cron | — | Idempotent. Overdue, missing, rental auto-release, owner payouts, sale auto-release, reminders 24 h and 2 h before a window closes (each sent once) |
| `get_wallet_summary()` → `{held, available, pending_payouts, deposits_held}[]` | self | — | — |
| `wallet_withdraw(p_amount)` → wallet_ledger | self | — | Simulated withdrawal (−available). Takes the per-user wallet lock, like every `wallet` payment (`private.take_payment`), so a payment and a withdrawal can't both spend the same balance |
| `mark_notifications_read(p_ids?)` → int | self | — | `null` marks all |
| `start_thread(p_listing_id, p_other_user_id, p_text, p_thread_id?, p_message_id?)` → `{thread_id, message_id, created}` | signed-in user | — | Reuses the pair's thread on that listing, or creates thread + participants + message atomically |
| `mark_thread_read(p_thread_id)` | participant | — | Sets `last_read_at`; clears that thread's message notification |
| `submit_review(p_rating, p_comment?, p_rental_id?, p_transaction_id?)` → reviews | a party of a closed deal | rental `released` / `resolved` / `missing`, or sale `released` / `resolved` / `completed` | One per author per deal; updates the subject's `rating` and `reviews_count`. Client helpers in `lib/api/reviews.ts`: `getMyReviewForDeal(target)` (deal page) and `listMyReviewedDealIds()` (one query for list pages); UI `components/review-dialog.tsx` and `components/rate-deal-button.tsx` (on `/transaction/[id]`, `/rentals`, the requests page and `/dashboard/orders`) |
| `admin_time_travel(p_id, p_hours)` → `'rental'` / `'sale'` | admin | — | Shifts a deal's timestamps back (for demos). Follow it with `run_escrow_jobs()`. |
| `admin_moderate_listing(p_listing_id, p_action, p_reason?)` → `'hidden'` / `'restored'` / `'removed'` | admin | `hide`: listing → `paused` + `hidden_at` (refused while a deal is in progress) · `restore`: clears the flag (stays paused) · `remove`: deletes (refused with history) | Seller notified. Migration `20261025020300_admin_moderation.sql`; wrapper `moderateListing` in `lib/api/moderation.ts` |
| `enable_premium_placement(p_listing_id, p_method = 'promptpay')` → listings | lister | listing `available`, not hidden, not already featured → featured for 7 days | Simulated ฿49 (BusinessRules §2): ledger payment −49 (`external`, or `available` for `wallet`, which needs the balance) and `platform_fee` +49 to the platform; `featured_until = now() + 7 days`; lister notified (`premium_placement`). Wrapper `enablePremiumPlacement` in `lib/api/listing-owner.ts` |
| `end_premium_placement(p_listing_id)` → listings | lister | featured → not featured | Ends it early. No refund. Wrapper `endPremiumPlacement` |
| `admin_stats()` → jsonb | admin | — (read) | `/admin/dashboard` counters: users, admins, listings, activeListings, hiddenListings, open/resolvedDisputes, rentalsInProgress, salesInEscrow, `heldEscrow` (Σ ledger `held`), `platformRevenue` (Σ ledger `platform`). Wrapper `getAdminStats` |
| `match_needs(p_need_id?)` → `{need_id, listing_id, featured, listed_at}[]` | signed-in user | — (read) | Pre-arrival matching (section 3.3). No argument: the caller's own needs; with an id: that need. Featured listings first, then newest. |
| `is_admin()`, `is_thread_participant(id)`, `is_rental_party(id)`, `is_transaction_party(id)`, `is_dispute_party(id)`, `can_read_evidence(path)`, `can_write_evidence(path)`, `listing_has_open_deal(id)`, `listing_has_history(id)` | RLS predicates (callable, return booleans about the caller) | — | — |

### 4.1 Final-review fixes (`20261025030000_review_fixes.sql`)

Wallet payments take `pg_advisory_xact_lock(hashtext('wallet:' || uid))` before reading the balance; the owner's rental fee is paid at `payout_at` even after a quick dispute decision; dispute amounts are whole baht; handover and return photos are required in SQL and only the renter confirms a handover; `mark_sold` needs the buyer's pending purchase; `release_sale` cancels the other in-person intents; the "Users can update their messages" policy and the `update` grant on `messages` are gone; listing counters are server-kept and the deposit is checked against the replacement value; item history is RPC-written. Tested in `supabase/tests/20261025030000_review_fixes.test.sql`.

Internal helpers live in the `private` schema, which the API can't see: `js_round` (JavaScript `Math.round`), `period_days`, `late_settlement`, `ledger`, `notify`, `settle_rental`, `release_sale`, …

**Fee parity.** The quotes are computed in double precision with JavaScript rounding (ties round up: ฿8.5 → ฿9). Postgres `round(float8)` rounds ties to even, so it is not used. Both `supabase/tests/00_fees.test.sql` and `npm run test:db` check this against `lib/fees.ts`.

---

## 5. Wallet ledger (simulated money)

Each row is `(user_id, kind, bucket, amount, memo, rental_id | transaction_id | dispute_id)`. The amount is signed.

| bucket | Meaning |
|---|---|
| `held` | The platform holds this for the user: a renter's deposit, or an owner's or seller's payout that isn't released yet |
| `available` | The user's in-app wallet (refunds, payouts). It can pay with method `wallet`. |
| `external` | Paid in from PromptPay or card. History only; not a balance. |
| `platform` | Platform revenue (`user_id` is null): commission, escrow fee, protection fee, premium placement |

Kinds: `payment`, `hold`, `hold_release`, `payout`, `refund`, `claim` (deposit share to the owner), `platform_fee`, `withdrawal`. Balances: `held = Σ held`, `available = Σ available` (`get_wallet_summary`). Example, the mini fridge (฿250 + ฿25 + ฿30 + ฿800):

| Event | Renter | Owner | Platform |
|---|---|---|---|
| `pay_rental` (PromptPay) | external −1105, held +800 | held +250 | +25, +30 |
| 48 h after handover | | held −250, available +250 | |
| `confirm_return` (on time) | held −800, available +800 | | |

---

## 6. Row Level Security summary

- RLS is enabled on every table. `anon` has no insert, update or delete anywhere and can read only `listings`, `listing_history` and `reviews`, plus call the two quote functions.
- `authenticated` lost insert, update and delete on the money and state tables and on `threads`, `thread_participants` and `reviews`. On `notifications` it can update only `read_at` (a column grant) and delete its own rows.
- Admin access is `users.is_admin`, which can only be set with SQL or the secret key (`scripts/seed-demo.mjs` marks the demo admin).
- `@ait.asia` only: the `enforce_ait_email` trigger on `auth.users` rejects any other domain on insert or on email change (subdomains and look-alikes too). The `before_user_created` auth hook (`private.hook_before_user_created`) returns a friendly 403 message. It is enabled locally in `supabase/config.toml`; on production, enable it in the dashboard (section 9).

Tested in `supabase/tests/04_rls.test.sql` (data-independent: counts are scoped to the rows the test creates, so it passes with demo data loaded): a stranger can't see or modify another user's rentals, purchases, ledger, notifications or chats, and can't join threads or write item history. Parties can't write money columns. Anon can't run the jobs.

---

## 7. Storage

| Bucket | Path | Read | Write |
|---|---|---|---|
| `listing-photos` (public, 5 MB, images) | `<uid>/<uuid>.<ext>` | Everyone (public URL) | Own folder: insert, update, delete |
| `dispute-evidence` (private, 10 MB, images + PDF) | `rental/<rentalId>/<uid>/<uuid>.<ext>` or `sale/<transactionId>/<uid>/<uuid>.<ext>` | The parties of that deal and admins (signed URLs) | The parties, in their own `<uid>` sub-folder only. No update or delete. |

Use `uploadListingPhoto(file)` (store the returned `publicUrl` in `listings.images`), `uploadEvidence({ kind, id }, file)` (pass the returned paths to `confirmHandover`, `markReturned`, `confirmReturn`, `confirmSaleHandover` or `fileDispute`) and `getEvidenceUrls(paths)`.

---

## 8. Realtime and scheduled work

- **Realtime** publishes `messages`, `notifications`, `rentals`, `transactions`, `disputes` and `dispute_comments`, filtered per subscriber by RLS. Helpers: `subscribeToMessages`, `subscribeToRentals`, `subscribeToTransactions`, `subscribeToNotifications(userId, …)`, `subscribeToDisputeComments(id, …)`. The store already follows messages, rentals and purchases.
- **`run_escrow_jobs()`** is scheduled with pg_cron every 10 minutes (`pass-it-on-escrow-jobs`) when the extension exists. The migration still applies without pg_cron. It is serialised with an advisory lock and safe to call often.
- **Client-side runs** all go through one throttle, `lib/escrow-runner.ts` (last run shared across tabs in `localStorage`): the store runs the jobs on sign-in and on `refresh()` unless they ran in the last 20 s (`maybeRunEscrowJobs`); `components/escrow-job-runner.tsx` runs them every 5 minutes while a tab is visible; pages whose countdown hits zero call `requestEscrowRun()` (waits out the 20 s gap); the admin demo tools call the RPC directly and record it with `noteEscrowRun()`. Every run dispatches `ESCROW_RAN_EVENT` so the deal and wallet pages reload.

---

## 9. Running it

### Local stack (Docker Desktop running)

```bash
npm run db:start            # npx -y supabase@2.122.0 start
npx -y supabase@2.122.0 status -o env   # local URL and keys
```

If `start` fails pulling a storage-api image tagged `revoke-grants-to-unused-operations`, rename `supabase/.temp/storage-version` to `storage-version.remote` and retry.

Create `.env.development.local` (git-ignored; `next dev` prefers it over `.env.local`, which holds production values for `next build`):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from status>
SUPABASE_SECRET_KEY=<SECRET_KEY from status>   # scripts only, never client code
```

Then run:

```bash
npm run db:reset            # re-apply migrations + supabase/seed.sql (empty)
npm run seed:demo           # demo accounts + data → demo-accounts.local.md
                            # (ratings recomputed from the seeded reviews; demo needs dated for the 6 Jan 2027 intake)
npm run dev                 # app against the local stack
```

Mailpit (local email inbox) is at http://127.0.0.1:54324 and Studio at http://127.0.0.1:54323.

### Tests

| Command | Needs DB | What |
|---|---|---|
| `npm test` | no | `lib/fees.ts` unit tests |
| `npm run test:sql` | local | pgTAP (`supabase/tests/*.sql`): fee parity, every transition and the forbidden ones, ledger, late / missing, reminders, disputes and caps, RLS, the email trigger, misc RPCs |
| `npm run test:db` | local | `quote_rental` / `quote_sale` over REST vs `lib/fees.ts` on a grid of inputs |
| `npm run demo:flow` | local | Rental request → approve → pay → handover → payout → return → release, plus a protected sale, as two real users |
| `npm run test:e2e` | local + `npm run dev` | Browser flows in `tests/e2e/` (seller, buyer, owner + renter with dispute and auto-release, late / missing, dead-link crawl, 390 / 1280 px quality pass) in headless Edge; writes `tests/e2e/RESULTS.md` |

Every pgTAP file is data-independent: it creates its own users and rows inside a rolled-back transaction and only asserts on those, so `npm run test:sql` passes on an empty database and after `npm run seed:demo` alike.

### Regenerate types after a schema change

```bash
npm run db:types   # supabase gen types --local > lib/database.types.ts, then oxfmt
```

### New migrations

Add `supabase/migrations/<timestamp>_<name>.sql`, run `npm run db:reset && npm run test:sql`, then regenerate the types. Never edit a migration that production has already applied.

### Production push (manual, after review)

**Order matters: migrations first, then the Vercel deploy right after.** The new app code needs the new schema (with the old schema the store's first listings query fails on `listings.featured_until`, and the RPCs, tables and buckets are missing), and the live `master` code writes `rentals` directly, which `20261025010000_p0_core.sql` forbids. So push the migrations and deploy `feat/p0-core` in one sitting, with no gap; until the deploy finishes, the old app can't create bookings. The migrations don't fail on existing rows (the new check constraints are supersets of the baseline ones; `owner_id` and `period_days` are backfilled before `SET NOT NULL`).

1. `npx -y supabase@2.122.0 link --project-ref cnpjndeuohdrrdmohios` (already linked).
2. `npx -y supabase@2.122.0 db push --dry-run`, which should list, in this order: `20261025010000_p0_core.sql`, `20261025020300_admin_moderation.sql`, `20261025020400_listing_featured_rank.sql`, `20261025020401_premium_placement.sql`, `20261025020500_needs_matching.sql`, `20261025030000_review_fixes.sql`, `20261025040000_legacy_escrow_backfill.sql`. (Production has none of them yet, so the order is fine and `--include-all` is not needed there. A local database that applied `…020500` before `…020401` existed needs `migration up --local --include-all`, or just `db reset`.)
3. `npx -y supabase@2.122.0 db push`.
3b. Deploy `feat/p0-core` to Vercel straight away (merge to `master`, or promote the preview), then do the dashboard steps below.
3c. Dashboard → Authentication → Providers → Email → **Confirm email: ON**. The `@ait.asia` rule only checks the domain; the confirmation mail is what proves the student owns the mailbox. (Locally `supabase/config.toml` keeps `enable_confirmations = false` so demo and test sign-ups work without Mailpit; the seed creates confirmed accounts.)
4. Dashboard → Authentication → Hooks → *Before User Created* → Postgres function `private.hook_before_user_created` (friendly message; the trigger enforces the rule without it).
4b. Dashboard → Authentication → URL Configuration → Redirect URLs: add `https://<site>/onboarding` (sign-up and `/verify-email` resend send the confirmation link back to `/onboarding`, where the browser client finishes the PKCE sign-in). Locally `supabase/config.toml` only allows `http://127.0.0.1:3000`, so confirmation links fall back to that site URL; the address is still confirmed and the student logs in from `/login`. Also add `https://<site>/reset-password?step=new` (the "Forgot password?" mail from `/reset-password` comes back there to set the new password). Locally that link falls back to `http://127.0.0.1:3000/`, where the reset form does not open; add `http://localhost:3000/**` to `additional_redirect_urls` (needs a Supabase restart) to test the whole flow locally.
5. Dashboard → Database → Extensions: check `pg_cron` is on and the job `pass-it-on-escrow-jobs` exists (`select * from cron.job`). If not, enable pg_cron and run the scheduling block at the end of the migration.
6. Existing rows are backfilled by the migration: legacy rentals get `owner_id`, fee columns from `quote`, and timestamps. Their payouts count as already settled, with no ledger history. Every auth user gets a profile row.
7. Optional: `node scripts/seed-demo.mjs --production` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` set in the environment. It refuses non-local URLs without the flag.

---

## 10. Open items (placeholders only, per BusinessRules)

- Admin approval for rentals worth more than ฿6,000: the `listings.replacement_value` column exists; there is no flow yet.
- A paid booking or protected purchase can't be cancelled before handover. The refund rule for a no-show isn't in BusinessRules.md yet; it needs a team decision. Until then an admin has to step in.
- Every signed-in user can read every profile row, including `email`, `arrival_date`, `departure_date` and `pickup_location` (baseline policy "Authenticated users can read profiles"). Fixing it needs column-level grants plus self/admin RPCs for the private fields, and the app reads `users.*` in seven places (store, profiles, onboarding, admin): deferred, see action_items.md §2.12.
- Premium placement is no longer open: it is charged (simulated ฿49 for 7 days) by `enable_premium_placement`, see section 4.
