# PassItOn — QA Checklist

> **How to use:** Work through each section top-to-bottom. Mark each item with one of:
> - `[ ]` Not tested yet
> - `[x]` Passed
> - `[~]` Partially works / minor issue
> - `[!]` Failed — log the bug in the Notes table at the bottom
>
> **Test account:** `test@ait.asia` / `testpassword@123`
> **Base URL:** `http://localhost:3000`
> **Last tested:** ___________
> **Tester:** ___________

---

## 1. Authentication & Session

### 1.1 Landing / Route Guard
- [ ] Visiting `http://localhost:3000` while **logged out** → redirected to `/login`
- [ ] Visiting any protected page (e.g. `/dashboard/listings`) while logged out → redirected to `/login?next=<url>`
- [ ] After login, the `?next=` param is respected and user lands on the original page
- [ ] Visiting `/login` or `/signup` while **logged in** → redirected to `/` (or `/onboarding` if not onboarded)

### 1.2 Login Page (`/login`)
- [ ] Page loads at `/login`
- [ ] Brand header ("PassItOn" logo + tagline) visible
- [ ] Email field accepts `@ait.asia` addresses
- [ ] Email field accepts `@ait.ac.th` addresses
- [ ] Email field rejects other domains with a clear error message
- [ ] Password field present and masked
- [ ] "Forgot password?" link navigates to `/reset-password`
- [ ] **Cloudflare Turnstile** CAPTCHA widget loads and renders
- [ ] Submit button remains disabled until Turnstile is passed
- [ ] Submitting without completing Turnstile shows "Please complete the security check"
- [ ] "Log in" button is disabled while `email` or `password` fields are empty
- [ ] Correct credentials → logged in and redirected (to `/onboarding` if not onboarded, else `/`)
- [ ] Wrong password → shows "That email and password don't match an account."
- [ ] Unconfirmed account → shows "Confirm your email address first" + "Resend the confirmation email" link
- [ ] **"Create an account"** button is prominent and navigates to `/signup`
- [ ] Session-expired banner shows when arriving via `?reason=session_expired`
- [ ] Email confirmed banner shows when arriving via `?confirmed=true`
- [ ] Pre-fills email when arriving via `?email=<address>` (e.g. from verify-email page)

### 1.3 Sign Up Page (`/signup`)
- [ ] Page loads at `/signup`
- [ ] Brand header visible
- [ ] Toggle between "AIT Email" and "App ID" methods works
- [ ] **AIT Email method:**
  - [ ] Name field is optional
  - [ ] Email placeholder shows `st123456@ait.asia or name@ait.ac.th`
  - [ ] Accepts `@ait.asia` domain without warning
  - [ ] Accepts `@ait.ac.th` domain without warning
  - [ ] Shows red warning for any other domain (e.g. `@gmail.com`)
  - [ ] Password field enforces minimum 6 characters
  - [ ] "Continue" button disabled until email + password filled
  - [ ] Clicking "Continue" → **Simulated Email Verification modal** appears
- [ ] **App ID method:**
  - [ ] Shows Application Number input with placeholder `AIT-2026-XXXX`
  - [ ] Submitting without `AIT-` prefix shows validation error
  - [ ] Shows informational notice (not yet connected)
- [ ] "Log in" link at bottom navigates to `/login`
- [ ] Terms of Service / Privacy Policy text shown at bottom

### 1.4 Simulated Email Verification Modal
- [ ] Modal appears fullscreen with backdrop blur after clicking "Continue"
- [ ] Shows correct email address being verified
- [ ] After ~2 seconds, inbox preview appears with code `123456`
- [ ] Inbox preview box visible with simulated subject line and 6-digit code
- [ ] Code input field accepts only digits (max 6)
- [ ] Submitting wrong code → "Incorrect code. Try again." error
- [ ] Code field cleared and re-focused after wrong entry
- [ ] Entering correct code `123456` → green checkmark / "Email verified!" state
- [ ] After success, `supabase.auth.signUp()` is called and user progresses
- [ ] "← Change email" closes modal and returns to form
- [ ] "Resend code" button works with 30-second cooldown
- [ ] Cooldown timer counts down visibly

### 1.5 Email Verification Page (`/verify-email`)
- [ ] Page loads after successful signup (Supabase email confirmation on)
- [ ] Displays email address the link was sent to
- [ ] "Resend confirmation email" form visible
- [ ] Resend button has 60-second cooldown after sending
- [ ] Success notice shown after resend
- [ ] Error notice shown if resend fails
- [ ] Local dev notice shown when using local Supabase (with Mailpit link)
- [ ] "← Back to login" link works

### 1.6 Session, Logout & Auto-Logout
- [ ] Refreshing the page keeps the user logged in (JWT cookie persists via proxy.ts)
- [ ] Opening a new tab keeps the session alive
- [ ] **Auto-logout:** After 60 minutes of inactivity → session ends → redirected to `/login?reason=session_expired`
- [ ] "Your session expired due to inactivity" banner shows on the login page after auto-logout
- [ ] Logging out via the header menu → session cleared → redirected to `/login`
- [ ] After logout, pressing browser Back does not reveal authenticated content
- [ ] Signing out from another device triggers SIGNED_OUT redirect on this session

### 1.7 Reset Password (`/reset-password`)
- [ ] Page loads
- [ ] Accepts AIT email address
- [ ] Submitting sends password reset email (or shows local dev notice)
- [ ] Pre-fills email when arriving via `?email=<address>`

---

## 2. Onboarding (`/onboarding`)

- [ ] Redirected here automatically after first login (before `onboarded_at` is set)
- [ ] Name field required (error if empty on submit)
- [ ] Program field (optional text)
- [ ] Batch/year field (optional text)
- [ ] **Pickup Location** dropdown shows all 9 locations: Dorm A Lobby, Dorm B Lobby, AIT Married Housing, Student Union Building, AIT Library, SET Building, SERD Building, Sports Complex, AIT Conference Center
- [ ] At least one **Role Intent** must be selected (Buy / Sell / Rent / Rent Out)
- [ ] Multiple intents can be selected simultaneously
- [ ] Arrival date / Departure date fields (optional)
- [ ] Departure must be after arrival (validation error if not)
- [ ] Clicking "Finish" saves profile and redirects to `?next=` param or `/`
- [ ] Returning to `/onboarding` when already onboarded → acts as profile edit
- [ ] Errors from API shown as inline banner

---

## 3. Home Page (`/`)

- [ ] Page loads with search hero section
- [ ] Search bar functional (typing + Enter → `/search?q=<term>`)
- [ ] Category grid shows all 7 categories: Furniture, Electronics, Bicycles, Textbooks, Kitchen & Household, Sports Equipment, Other
- [ ] Clicking a category → filters the listing grid by that category
- [ ] Listing grid shows active listings
- [ ] Featured listings appear first in the grid
- [ ] Filter bar visible (type, category, condition, price)
- [ ] Footer visible at the bottom

---

## 4. Browse & Search

### 4.1 Browse (`/browse`)
- [ ] Same layout as home with filter bar active
- [ ] Listings load from the database

### 4.2 Search (`/search`)
- [ ] URL param `?q=` drives search results
- [ ] Results update when query changes
- [ ] "No results" empty state shown when nothing matches
- [ ] Filter bar works alongside search

### 4.3 Filter Bar
- [ ] **Type** filter: All / For Sale / For Rent
- [ ] **Category** filter: all 7 categories + All
- [ ] **Condition** filter: New / Like New / Good / Fair / Parts Only
- [ ] **Price** range filter (min / max inputs)
- [ ] Filters combine correctly (e.g. Electronics + For Rent + max price)
- [ ] Clearing filters resets the listing grid

---

## 5. Listing Detail (`/listing/[id]`)

- [ ] Page loads for a valid listing ID
- [ ] Images displayed (carousel if multiple)
- [ ] Title, price, condition, category, pickup location all shown
- [ ] Seller name + avatar shown; clicking → `/profile/[userId]`
- [ ] Seller star rating displayed
- [ ] Item history / previous owners section visible
- [ ] Reviews section visible
- [ ] **For Sale listing:**
  - [ ] "Buy now" / checkout button visible to non-owners
  - [ ] In-person vs. Protected sale modes explained
  - [ ] Checkout button → `/listing/[id]/checkout`
- [ ] **For Rent listing:**
  - [ ] "Request Rental" button visible to non-owners
  - [ ] Deposit amount and rental period shown
- [ ] **Own listing:** Edit / Delete / Mark Sold options shown (no buy/rent buttons)
- [ ] "Contact Seller" message button opens chat thread
- [ ] 404 / error state for invalid listing ID
- [ ] Listings with status `sold` / `rented` show appropriate badge

---

## 6. Create / Edit Listing

### 6.1 Create Listing (`/sell`)
- [ ] Page loads (redirects to login if not authenticated)
- [ ] Title field required
- [ ] Description field required
- [ ] Category dropdown: all 7 categories selectable
- [ ] Type toggle: For Sale / For Rent
- [ ] Price field required (numeric)
- [ ] **For Rent only:** Deposit field + Rental Period field appear
- [ ] Condition dropdown: New / Like New / Good / Fair / Parts Only
- [ ] Pickup Location dropdown: all 9 locations
- [ ] Image upload: at least one image required
- [ ] Multiple images can be uploaded
- [ ] Premium Placement checkbox / toggle visible
- [ ] Submitting with missing required fields shows validation errors
- [ ] Successful submit → listing created + redirected

### 6.2 Edit Listing (`/dashboard/listings/[id]/edit`)
- [ ] All existing fields pre-populated
- [ ] All fields editable
- [ ] Saving updates the listing in the database
- [ ] Cancel returns without saving
- [ ] Only the listing owner can access (redirected otherwise)

---

## 7. My Listings (`/my-listings` / `/dashboard/listings`)

- [ ] Shows only the current user's listings
- [ ] Each listing card shows: title, price, status badge, view count
- [ ] Status badges: active, rented, sold, paused, reserved
- [ ] Edit button → `/dashboard/listings/[id]/edit`
- [ ] Delete button → confirmation dialog → deletes (error if has rental/sale history)
- [ ] "Mark as Sold" available on active sale listings
- [ ] Rental listings show "View requests" → `/dashboard/listings/[id]/requests`
- [ ] Empty state shown when no listings

---

## 8. Rental Flow

### 8.1 Request a Rental
- [ ] "Request Rental" button visible on for-rent listings (non-owners only)
- [ ] Optional message field in request dialog
- [ ] Submitting → rental created in `requested` phase
- [ ] Confirmation toast shown

### 8.2 Owner: Manage Requests (`/dashboard/listings/[id]/requests`)
- [ ] Pending requests listed with renter info and message
- [ ] **Approve** → rental enters `approved` phase
- [ ] **Decline** → reason field → rental enters `declined` phase
- [ ] Decline reason visible to renter

### 8.3 Renter: Pay Deposit
- [ ] After approval, "Pay deposit" prompt visible in `/rentals`
- [ ] Payment method options: PromptPay QR / Card / Wallet (if balance)
- [ ] PromptPay shows simulated QR code
- [ ] Paying → rental enters `paid` phase, deposit held in escrow

### 8.4 Handover
- [ ] Owner: "Confirm Handover" button on `paid` rental
- [ ] Optional photo upload
- [ ] Confirming → rental enters `active` phase, start/due dates set

### 8.5 Return
- [ ] Renter: "Mark as Returned" on `active` rental
- [ ] Optional return photo upload
- [ ] → rental enters `return-pending` phase
- [ ] Owner: "Confirm Return" button
- [ ] 48-hour dispute window shown with countdown
- [ ] After 48h or owner confirmation → deposit released, rental enters `released`

### 8.6 Late Returns
- [ ] Overdue rentals show `overdue` badge
- [ ] Late fee calculated and displayed
- [ ] 7+ days overdue → `missing` phase, deposit awarded to owner

### 8.7 Cancel Rental
- [ ] Renter or owner can cancel before `paid` phase
- [ ] Optional reason field
- [ ] Cancelled rental shows `cancelled` badge

---

## 9. Sales Flow

### 9.1 Checkout (`/listing/[id]/checkout`)
- [ ] Page loads for a For Sale listing
- [ ] **In-person sale:**
  - [ ] No online payment required
  - [ ] "Confirm in-person deal" creates a `pending` transaction
  - [ ] Seller receives "Mark as Sold" prompt
- [ ] **Protected sale:**
  - [ ] Buyer protection fee shown (% + minimum)
  - [ ] Total price calculated correctly
  - [ ] Payment method: PromptPay / Card / Wallet
  - [ ] PromptPay shows simulated QR code
  - [ ] Paying → transaction enters `paid` phase
- [ ] Navigates to `/transaction/[id]` after checkout

### 9.2 Transaction Detail (`/transaction/[id]`)
- [ ] Status, parties (buyer/seller), price, and breakdown shown
- [ ] Protected sale: seller sees "Confirm Handover" button
- [ ] Buyer: "Confirm Receipt" option shown
- [ ] 48-hour dispute window countdown visible
- [ ] Funds auto-release after 48h if buyer doesn't dispute
- [ ] After release: "Leave a review" prompt visible

### 9.3 Transaction Confirm (`/transaction/[id]/confirm`)
- [ ] Handover confirmation form works
- [ ] Photo upload (evidence) works

---

## 10. Dashboard

### 10.1 Orders (`/dashboard/orders`)
- [ ] All purchases and sales for current user listed
- [ ] Filter by Buying / Selling
- [ ] Each row: item title, counterparty name, status, amount
- [ ] Clicking a row → transaction detail page

### 10.2 Rentals (`/rentals`)
- [ ] All rentals where user is renter OR owner listed
- [ ] Correct phase badges on each rental
- [ ] Action buttons contextual to current phase
- [ ] Empty state when no rentals

### 10.3 Wallet (`/dashboard/wallet`)
- [ ] Four summary cards: Held / Available / Pending Payouts / Deposits Held
- [ ] Ledger history listed chronologically
- [ ] Ledger filterable by entry kind
- [ ] "Withdraw" button enabled when Available > 0
- [ ] Withdrawal flow shows simulated confirmation
- [ ] "Simulated payments" disclaimer visible on page

### 10.4 Settings (`/dashboard/settings`)
- [ ] Name, program, batch, pickup location all editable
- [ ] Role intents can be adjusted
- [ ] Saving updates the profile in the database

---

## 11. Chat (`/chat`)

- [ ] Thread list shows all active conversations
- [ ] Threads sorted by most recent message
- [ ] Clicking a thread opens the message view
- [ ] Messages show: sender avatar, name, text, timestamp
- [ ] Message input + Send button functional
- [ ] Sent messages appear immediately (optimistic update)
- [ ] New messages from other party appear in real time (no manual refresh needed)
- [ ] Simulated bot reply appears after a short delay (demo feature)
- [ ] Listing thumbnail / title shown in thread header
- [ ] Empty state when no chats

---

## 12. Needs Board (`/needs`)

- [ ] Page loads, showing all posted needs
- [ ] "Post a Need" button visible
- [ ] **Create Need form:**
  - [ ] Title required
  - [ ] Category dropdown: all 7 categories
  - [ ] Note / description field
  - [ ] Arrival date field
  - [ ] Submit → need created and visible in list
- [ ] Needs listed with title, category, user, arrival date
- [ ] Own needs have a Delete button
- [ ] Empty state when no needs posted

---

## 13. Disputes

### 13.1 File a Dispute (`/dispute/new`)
- [ ] Accessible via `/dispute/new?rental=<id>` or `/dispute/new?transaction=<id>`
- [ ] Only available within the 48-hour dispute window
- [ ] Countdown timer for dispute window visible
- [ ] Related rental/transaction details shown
- [ ] Reason dropdown: normal-wear / repairable-damage / lost-or-destroyed / not-as-described
- [ ] Description textarea required
- [ ] Evidence photo upload works (multiple files accepted)
- [ ] Claim amount field (optional)
- [ ] Submit → dispute created, redirected to `/dispute/[id]`
- [ ] Error shown if a dispute already exists for this deal

### 13.2 Dispute Detail (`/dispute/[id]`)
- [ ] Both parties can view the dispute
- [ ] Evidence photos displayed
- [ ] Reason, description, claim amount shown
- [ ] Status badge: open / resolved
- [ ] Comment thread visible; either party can post comments
- [ ] Attachments can be added to comments
- [ ] Resolution details shown when status is `resolved` (finding, amounts, admin note)

---

## 14. Notifications (`/notifications`)

- [ ] Page loads and lists all notifications (newest first)
- [ ] Unread notifications highlighted differently
- [ ] Clicking a notification → marks as read + navigates to relevant page
- [ ] Notification bell in header shows unread count badge
- [ ] "Mark all as read" option works
- [ ] Empty state shown when no notifications exist

---

## 15. User Profile (`/profile/[userId]`)

- [ ] Page loads for any user ID
- [ ] Avatar, name, program, batch shown
- [ ] Star rating and review count shown
- [ ] Member since date shown
- [ ] Listings tab: user's active listings
- [ ] Reviews tab: reviews received from others
- [ ] Own profile: "Edit profile" button (→ `/onboarding`)
- [ ] Invalid user ID → 404 or error state

---

## 16. How It Works (`/how-it-works`)

- [ ] Page loads
- [ ] Buy / Sell / Rent flows explained in content
- [ ] Fee structure explained (commission, escrow, protection)
- [ ] Escrow and buyer protection described

---

## 17. Admin Panel

### 17.1 Access Control
- [ ] `/admin/*` pages redirect non-admin users to `/` or show access denied
- [ ] Admin user (`isAdmin = true` in DB) can access all admin pages

### 17.2 Admin Overview (`/admin`)
- [ ] Stats overview visible (active listings, users, open disputes, transactions)
- [ ] Navigation links to sub-sections

### 17.3 Admin — Users (`/admin/users`)
- [ ] All users listed: name, email, program, joined date
- [ ] Search / filter by name or email
- [ ] Clicking a row → user profile

### 17.4 Admin — Listings (`/admin/listings`)
- [ ] All listings from all users visible
- [ ] Status filter works
- [ ] Admin can delete any listing
- [ ] Admin can change listing status

### 17.5 Admin — Disputes Queue (`/admin/disputes`)
- [ ] Open disputes listed first (oldest first)
- [ ] Resolved disputes listed after
- [ ] Search bar filters by listing title or user name
- [ ] Filter tabs: Open / Resolved / All
- [ ] Clicking a row → `/admin/disputes/[id]`

### 17.6 Admin — Dispute Resolution (`/admin/disputes/[id]`)
- [ ] All dispute details shown: parties, evidence photos, comment thread
- [ ] Linked rental or transaction details shown
- [ ] Resolution form:
  - [ ] Finding dropdown: normal-wear / repairable-damage / lost-or-destroyed / not-as-described
  - [ ] Resolution amount field
  - [ ] Deposit split (to owner / to renter)
  - [ ] Resolution note textarea
  - [ ] Submit → dispute enters `resolved` state
- [ ] Resolution outcome visible to both parties

---

## 18. Cookies Consent Banner

- [ ] Banner slides in from bottom-right on **first visit** (no prior decision)
- [ ] Shows: cookie icon, explanation, "Accept all" + "Decline optional" buttons + ✕
- [ ] "Accept all" → banner disappears, `cookie_consent = accepted` saved in localStorage
- [ ] "Decline optional" → banner disappears, `cookie_consent = rejected` saved in localStorage
- [ ] ✕ dismiss → same effect as "Decline optional"
- [ ] Refreshing after accepting → banner does **not** appear
- [ ] Clearing localStorage (DevTools → Application → Clear) → banner reappears

---

## 19. Site Header / Navigation

- [ ] Header visible on all authenticated pages
- [ ] PassItOn logo → navigates to `/`
- [ ] Navigation links present: Browse, How It Works, My Listings, Needs
- [ ] Notification bell icon with unread count badge
- [ ] User avatar / dropdown menu visible when logged in:
  - [ ] Profile → `/profile/[userId]`
  - [ ] Dashboard → `/dashboard/listings`
  - [ ] Wallet → `/dashboard/wallet`
  - [ ] Orders → `/dashboard/orders`
  - [ ] Settings → `/dashboard/settings`
  - [ ] Log out → signs out + `/login`
- [ ] Admin link visible **only** for admin users
- [ ] "Sell" / "List an item" CTA button visible
- [ ] On mobile: nav collapses to hamburger menu
- [ ] Seasonal announcement bar shown above header (when active)

---

## 20. Fees & Calculations

- [ ] Rental fee = daily rate × period days (shown in checkout and ledger)
- [ ] Rental commission 10% of the rental fee, paid by the renter at booking, shown in checkout
- [ ] Escrow fee = max(flat rate, % of deposit) shown
- [ ] Buyer protection fee for protected sales = ฿10 + 3% of the price (shown in checkout)
- [ ] Sale commission on protected sales = 10% of what the seller keeps, taken from the payout (seller sees the net amount; none on in-person sales or a full refund)
- [ ] Late fee = daily rate × late days, capped at deposit amount
- [ ] Deposit settlement on dispute resolution: amounts to owner + renter add up correctly
- [ ] Wallet ledger entries match displayed fee breakdowns

---

## 21. Premium Listings

- [ ] Seller can enable "Premium Placement" when creating or editing a listing
- [ ] Featured listings appear before non-featured in browse / search
- [ ] Featured badge shown on listing card and detail page
- [ ] Featured status expires after 7 days (`featuredUntil`)
- [ ] Expired featured listings no longer shown at the top

---

## 22. Cross-Browser & Responsive Design

- [ ] Chrome (latest) — no visual regressions
- [ ] Firefox (latest) — no visual regressions
- [ ] Safari (latest) — no visual regressions
- [ ] Mobile 375px — header collapses, all tap targets adequate (min 44px)
- [ ] Tablet 768px — layout adapts correctly (no overflow, no tiny text)
- [ ] **Dark mode** — all pages render correctly with dark colour palette
- [ ] **Light mode** — all pages render correctly with warm light palette

---

## 23. Performance & Polish

- [ ] Home page (logged-in) loads visibly in < 3 seconds on localhost
- [ ] No JS console errors on home page (logged-in)
- [ ] No JS console errors on home page (logged-out / login page)
- [ ] No React hydration mismatch warnings in console
- [ ] All images load (no broken image icons)
- [ ] Toast notifications appear and auto-dismiss
- [ ] Loading spinners / skeleton states shown during data fetches
- [ ] No routes that hang in a loading state (errors surface as messages)
- [ ] Smooth page transitions (no white flash between routes)

---

## 24. Security

- [ ] Non-AIT email rejected at login (client-side validation)
- [ ] Non-AIT email rejected at signup (client + server enforcement)
- [ ] Unauthenticated requests to Supabase return 401 (check browser Network tab)
- [ ] Cannot view another user's chat thread by guessing a thread URL
- [ ] Cannot reach `/dashboard/listings/[id]/edit` for a listing you don't own
- [ ] `/admin/*` returns 403 / redirect for non-admin authenticated users
- [ ] `?next=` redirect rejects external URLs (e.g. `?next=https://evil.com` → ignored)
- [ ] Turnstile token validated before login proceeds (demo uses always-pass test key)

---

## 25. Edge Cases & Error States

- [ ] `/listing/nonexistent-id` → graceful error message or 404 page
- [ ] Submitting any form while network is offline → error toast, no silent failure
- [ ] Requesting a rental on your **own** listing → button hidden or clear error
- [ ] Buying your **own** listing → button hidden or clear error
- [ ] Uploading a file that is too large → error message (not silent rejection)
- [ ] Uploading an unsupported file type → error message
- [ ] Opening a second dispute on the same deal → error "dispute already exists"
- [ ] Paying a rental that has already been cancelled → error shown

---

## Notes / Bugs Found

> Fill in as you test. Use the # column to reference issues in comments.

| # | Section | Page / Feature | Description | Severity | Status |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

---

*Generated by Antigravity on 2026-10-26. Update `Last tested` and `Tester` fields at the top each session.*
