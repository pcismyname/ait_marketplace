# AIT Circular — User Flows & Route Map

**Last updated:** 2026-10-07 (Pass 2 — Zara/H&M layout, My Listings)

---

## Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Home | Hero + category chips + featured/rent/recent grids + CTA banner + footer |
| `/browse` | Browse | Filter bar + 4-col product grid + load more |
| `/browse?category=<id>` | Browse (filtered) | Pre-fills category chip filter |
| `/browse?type=rent` | Browse (rent only) | Pre-fills type chip filter |
| `/browse?q=<query>` | Browse (searched) | Pre-fills search result |
| `/listing/[id]` | Listing detail | Image gallery + sticky info panel + accordions + reviews + related items |
| `/sell` | List item | Create listing form → redirects to `/my-listings` on publish |
| `/my-listings` | My listings | Seller dashboard: own listings, status tabs, per-item actions |
| `/chat` | Messages | Two-panel inbox: thread list + conversation |
| `/needs` | Pre-arrival | Register a need + community needs board + auto-matched listings |
| `/rentals` | My rentals | Active rentals + deposit escrow status + return flow |

---

## Header Navigation

**Desktop nav bar (left → right):**
- Wordmark `AIT Circular` (italic, links to `/`)
- Category links (Furniture, Electronics, Bicycles, Textbooks, Kitchen & Household, Sports Equipment)
- [spacer]
- Search icon → expands search overlay input
- Heart icon → `/browse?favorites=1` (saved items)
- Message icon → `/chat` (unread badge)
- `My listings` text link → `/my-listings`
- `List` button (solid green) → `/sell`
- Avatar

**Mobile:**
- Wordmark + Search icon + Hamburger
- Hamburger opens right-side slide-out drawer with: categories + account links + "List an item" CTA

---

## Key User Flows

### 1. Browse → View → Contact seller
```
/ (home) 
  → click category chip / "Browse all" / product card
→ /browse (filter bar)
  → [optional] click filter chip (Type / Category / Condition / Location)
  → click product card
→ /listing/[id]
  → click "Message seller" → ContactSellerDialog opens
  → sends first message → thread created → redirects to /chat
```

### 2. Browse → View → Request to rent
```
/browse (filtered: type=rent)
  → click rental product card
→ /listing/[id]
  → click "Request to rent · ฿XXX"
  → RentCheckoutDialog opens: shows quote breakdown, payment method selector
  → click "Pay ฿XXX" → rental created, deposit in escrow, chat thread opened
  → redirects to /rentals
```

### 3. List item → My Listings
```
Header: click "List" button
→ /sell (list item form)
  → fill in type (sale/rent), photos, title, description, category, condition, price, pickup
  → [optional] toggle premium placement
  → click "Publish listing"
  → toast: "Your listing is live!"
→ /my-listings (redirect)
  → new listing appears under "Active" tab
```

### 4. My Listings — manage a listing
```
/my-listings
  ├── View → /listing/[id] (public view)
  ├── Edit → /sell?edit=[id] (form pre-filled, same UX — note: edit pre-fill not yet implemented, shows empty form)
  ├── Pause → status → 'paused' (hidden from browse)
  ├── Republish → status → 'available' (visible again)
  ├── Mark as sold → status → 'sold'
  ├── View messages → /chat (if open thread exists)
  └── Delete → confirmation dialog → listing removed
```

### 5. My Listings — see open conversation
```
/my-listings
  → item with "Open conversation" link (shown when thread exists for that listing)
  → click link → /chat (opens that thread)
```

### 6. Return a rented item
```
/rentals
  → active rental card
  → click "Mark item as returned"
  → status → 'return-pending'
  → [owner confirms] click "Confirm return & release deposit"
  → status → 'released', deposit refunded
  → [or] click "Report damage" → status → 'disputed' → /chat
```

### 7. Register a pre-arrival need
```
/needs
  → fill form: what you need, category, arrival date, notes
  → click "Register need"
  → toast with match count
  → need appears in "Your needs" with matched listing cards (if any)
  → community needs board shows others' needs → can click "List one" → /sell
```

---

## Data Model Changes (Pass 2)

### `ListingStatus` — added `'paused'`
```ts
export type ListingStatus = 'available' | 'reserved' | 'sold' | 'rented' | 'paused'
```
Paused listings are hidden from `/browse` and search results but remain in the database and are visible in `/my-listings`.

### `Listing` — added `viewCount?: number`
Optional field for light stats display in My Listings. Not yet incremented by page views (placeholder).

### Store — new actions
| Action | Description |
|---|---|
| `deleteListing(id)` | Removes listing from state permanently |
| `updateListingStatus(id, status)` | Transitions listing to any valid status |
| `toggleFavorite(id)` | Adds or removes a listing ID from `favoriteIds: Set<string>` |
| `favoriteIds` | In-memory Set of saved listing IDs (not persisted across refresh) |

---

## Components Added / Changed (Pass 2)

| Component | Change |
|---|---|
| `components/announcement-bar.tsx` | NEW — dismissible one-line banner at top of header |
| `components/site-header.tsx` | REWRITTEN — announcement bar + category nav + icon row + mobile drawer |
| `components/listing-card.tsx` | REWRITTEN — now exports `ProductCard`. Zara/H&M image-first style, 3:4 ratio, no border/shadow, heart icon, 3-line text. Old `ListingCard` removed. |
| `components/image-placeholder.tsx` | NEW — tinted sage placeholder with thin category icon for SVG/no-photo listings |
| `components/filter-bar.tsx` | NEW — sticky H&M-style bar with dropdown chips + slide-over "All filters" drawer |
| `components/section-header.tsx` | Kept (used internally) |
| `components/seasonal-banner.tsx` | Kept (used on home page) |
| `components/why-section.tsx` | Removed from home page (replaced by simpler grid) |
| `components/home-hero.tsx` | Removed (inlined into app/page.tsx) |
| `components/category-grid.tsx` | Removed (replaced by simpler chip row) |
| `app/page.tsx` | REWRITTEN — uses ProductCard, max-w-7xl, footer inlined |
| `app/browse/page.tsx` | REWRITTEN — no sidebar, FilterBar + 4-col ProductCard grid + load more |
| `app/listing/[id]/page.tsx` | REWRITTEN — gallery left + sticky panel right + accordions |
| `app/my-listings/page.tsx` | NEW — seller dashboard with status tabs + row layout + actions |
| `app/sell/page.tsx` | Updated redirect to `/my-listings` post-publish |
| `app/needs/page.tsx` | Updated import: `ListingCard` → `ProductCard` |

---

## Notes / Limitations

- **Edit listing** (`/sell?edit=[id]`): The route exists in nav but the form does not pre-fill from a listing ID yet. The empty sell form opens. This is the next incremental feature.
- **Favorites persistence**: `favoriteIds` is in-memory React state. Favorites reset on page refresh. Would need Supabase or localStorage to persist.
- **View count**: `listing.viewCount` is seeded as `undefined` in most listings. The detail page doesn't yet increment it.
- **Seller filter**: `/browse?seller=[id]` link exists on detail page "See all listings" but the browse page doesn't filter by `sellerId` yet. It falls back to showing all.
