# PassItOn — Design System
**Single source of truth for all visual and UX decisions.**
Update this file whenever a design decision changes.

---

## Design Principles

1. **Every element earns its place.** When in doubt, remove it.
2. **Natural and grounded**, not techy or startup-ish. Think a shaded AIT campus, not a SaaS dashboard.
3. **Deliberate asymmetry.** Left-aligned sections, varied column widths, no forced symmetry.
4. **Images lead.** Where the app has imagery (listings, chat thumbnails), let images do the work. Quiet everything else.
5. **Human copy.** Short, specific to AIT student life. No filler marketing phrases.

---

## Visual References (source design DNA)

| Reference | What we borrow |
|---|---|
| **Homedine (Crockery/Kitchenware)** | Color palette (deep green + cream + terracotta), full-bleed image approach, italic serif headline moments, warm tinted review panels |
| **Moss E-commerce** | Structure: thin nav, small uppercase labels, generous whitespace, left sidebar filters, quiet product grids |
| **Ronas IT E-commerce** | Clarity on detail screens: breadcrumbs, clean image area, limited palette so images stand out, rating breakdowns |
| **Nexura Travel Gear** | Sections: feature strips, stats rows, multi-column footer — but without the black/heavy condensed display style |

---

## Color Palette

All colors are defined in `app/globals.css` as OKLCH tokens.
**Never use hardcoded hex values in components. Always use token names.**

### Core Tokens (Light Mode)

| Token | Role | OKLCH | ~Hex |
|---|---|---|---|
| `--background` | Page canvas — warm oat/cream | `oklch(0.968 0.009 82)` | `#F5F3EE` |
| `--foreground` | Body text — warm dark charcoal | `oklch(0.19 0.022 140)` | `#1C2A1E` |
| `--surface` | Raised panels, sidebars — slightly warmer than bg | `oklch(0.955 0.012 80)` | `#F1EEE8` |
| `--surface-tinted` | Tinted image/card backgrounds, category chips | `oklch(0.94 0.018 130)` | `#EBF0E8` |
| `--card` | White-ish card for contrast against canvas | `oklch(0.99 0.004 88)` | `#FDFCFA` |
| `--card-foreground` | Text on cards | same as foreground | — |
| `--primary` | Deep forest/bottle green — dominant brand color | `oklch(0.36 0.095 148)` | `#284F35` |
| `--primary-foreground` | Text on primary backgrounds | `oklch(0.97 0.008 88)` | `#F5F3EE` |
| `--primary-muted` | Diluted green — chip bg, hover fills, active states | `oklch(0.90 0.030 140)` | `#DFF0E3` |
| `--secondary` | Sage — secondary buttons, active nav | `oklch(0.88 0.038 138)` | `#D4E8D8` |
| `--secondary-foreground` | Text on secondary | `oklch(0.28 0.065 148)` | `#274D30` |
| `--muted` | Warm stone — used for hover fills | `oklch(0.945 0.011 78)` | `#EDEAE4` |
| `--muted-foreground` | Subdued / secondary text | `oklch(0.50 0.018 102)` | `#7A7668` |
| `--accent` | Muted terracotta/clay — use very sparingly | `oklch(0.72 0.10 38)` | `#B8724A` |
| `--accent-foreground` | Text on accent | `oklch(0.98 0.005 88)` | `#FBF9F7` |
| `--border` | Thin warm stone lines | `oklch(0.875 0.013 88)` | `#DAD5CD` |
| `--input` | Input borders | same as border | — |
| `--ring` | Focus ring | same as primary | — |
| `--destructive` | Errors, delete | `oklch(0.56 0.20 25)` | `#C23A1E` |

### Seasonal / Surge (amber — for semester event banners only)

| Token | Role | OKLCH | ~Hex |
|---|---|---|---|
| `--surge` | Amber accent | `oklch(0.66 0.12 65)` | `#BE8030` |
| `--surge-foreground` | Text on surge | `oklch(0.28 0.08 55)` | `#4A3010` |
| `--surge-surface` | Surge panel background | `oklch(0.955 0.038 76)` | `#FAF0DC` |

### Dark Mode
Dark mode stays in the same green-hue family, primary lightens for accessibility:

| Token | OKLCH | ~Hex |
|---|---|---|
| `--background` | `oklch(0.16 0.020 148)` | `#141E16` |
| `--foreground` | `oklch(0.935 0.010 84)` | `#EDE9E0` |
| `--card` | `oklch(0.205 0.022 148)` | `#1A2B1C` |
| `--primary` | `oklch(0.68 0.135 148)` | `#5CAA72` |

### Color Usage Rules

| Situation | Token to use |
|---|---|
| CTA buttons, active nav indicator, icon highlights | `primary` |
| Category icon containers, chip backgrounds, active list item | `primary-muted` |
| Hover state on cards, sidebar nav items | `muted` |
| Raised content areas (sidebar, forms) vs page | `surface` |
| Image placeholder backgrounds, tinted cells | `surface-tinted` |
| Review panels (warm background) | `surface` |
| Seasonal event banners only | `surge-surface` + `surge-foreground` |
| Terracotta accent | `accent` — max once per screen, small highlights only |
| Errors, destructive actions | `destructive` |

---

## Typography

### Fonts

| Role | Font | Stack | CSS variable |
|---|---|---|---|
| **Body / UI** | Instrument Sans | geometric humanist sans | `--font-sans` → `var(--font-instrument)` |
| **Display / Serif moments** | Playfair Display | elegant editorial serif | `--font-display` → `var(--font-playfair)` |

Loaded in `app/layout.tsx` via `next/font/google`.

### Type Scale

| Element | Class pattern | Size | Weight | Font |
|---|---|---|---|---|
| Hero headline | `text-[2.6rem] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.02em]` | 42–56px | 600 | Instrument Sans |
| Serif italic moment inside headline | `font-display italic text-primary` | (inherits) | 400 | Playfair Display |
| Page heading | `text-2xl font-semibold tracking-tight sm:text-3xl` | 24–30px | 600 | Instrument Sans |
| Card/feature heading | `text-xl font-semibold tracking-tight` | 20px | 600 | Instrument Sans |
| Listing title (detail) | `text-xl font-semibold` | 20px | 600 | Instrument Sans |
| Price (display) | `font-display text-3xl font-bold` | 30px | 700 | Playfair Display |
| Price (card) | `font-display text-[15px] font-bold` | 15px | 700 | Playfair Display |
| Body paragraph | `text-[14px] leading-relaxed` | 14px | 400 | Instrument Sans |
| Body standard | `text-[13px] leading-relaxed` | 13px | 400 | Instrument Sans |
| Label/tag | `.label-tag` utility → 11px, 600, uppercase, tracking-wide | 11px | 600 | Instrument Sans |
| Micro text | `text-[11px]` | 11px | 400–500 | Instrument Sans |

### Usage Rules
- **Use Playfair Display only for:**
  - Italic emphasis within a headline (one or two words, not a full sentence)
  - Prices in detail contexts (`font-display text-3xl`)
  - The brand wordmark (`font-display italic`)
- **Never** use Playfair Display for body text, labels, or navigation
- Section headings use Instrument Sans, not Playfair
- The `.label-tag` class must be used consistently for all section tags and navigation group headers

---

## Spacing & Layout

### Page Container
```
mx-auto max-w-6xl px-4 md:px-6
```
Max width: **1152px**. Padding: 16px mobile, 24px desktop.

### Spacing Scale (key values)
| Usage | Class |
|---|---|
| Between page sections | `space-y-16` or `gap-16` (64px) |
| Within a section | `gap-8` (32px) |
| Between cards in a grid | `gap-3` (12px) |
| Card internal padding | `p-4` or `p-5` |
| Form field groups | `space-y-7` |
| Text/label to content | `mt-1` or `mb-2` |

### Border Radius
The base radius is **8px** — intentionally restrained (not bubbly, not sharp).

| Context | Class | Value |
|---|---|---|
| Full pill — chips, tags, avatar | `rounded-full` | 9999px |
| Small interactive items — badges | `rounded-sm` | 4px |
| Inputs, small buttons, message bubbles | `rounded-md` | 6px |
| Cards, panels, form containers | `rounded-xl` | 12px |
| Large image areas | `rounded-xl` | 12px |
| Hero/banner panels | `rounded-xl` | 12px |

> **No more `rounded-2xl`, `rounded-3xl` in components.** These were removed in this redesign.

---

## Components

### Buttons

| Variant | Pattern | Use |
|---|---|---|
| **Primary** | `bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-[13px] font-semibold` | Main actions |
| **Primary large** | `h-11 rounded-md` | Detail page CTAs |
| **Outline** | `border-border rounded-md` | Secondary actions |
| **Ghost** | `hover:bg-muted` | Cancel, nav |
| **Nav CTA** | `bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider` | "List item" in header |

> Buttons use `rounded-md`, **not** `rounded-full`. The pill shape is reserved for chips and tags.

### Cards
```
rounded-xl border border-border bg-card
transition-all duration-150 hover-lift
```
Cards sit on the warm cream canvas. The white-ish `bg-card` creates natural contrast without heavy borders or shadows. The `.hover-lift` utility (defined in globals.css) gives a subtle 2px lift.

### Listing Cards
- Image area uses `bg-surface-tinted` (pale sage) so there's no blank white box
- Type badge: `rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`
- Text hierarchy: category label (11px uppercase) → title (13px semibold) → price (Playfair 15px bold)

### Inputs
```
h-9 md:h-10 w-full rounded-md border border-input bg-card px-3.5 text-[13px]
outline-none transition
focus:border-primary/60 focus:ring-2 focus:ring-primary/10
placeholder:text-muted-foreground/60
```
Search bars use `rounded-full` (pill) as a visual differentiator from form fields.

### Navigation

**Site header:**
- Height: `h-14`
- Background: `bg-background/95 backdrop-blur-sm`
- Wordmark: `font-display italic font-bold text-[15px]`
- Nav links: `text-[11px] font-semibold uppercase tracking-widest` — active = `text-primary`, inactive = `text-muted-foreground`
- No underlines on nav links; color shift is the indicator
- No announcement bar (removed — it added noise)

**Browse sidebar:**
- Filter group labels: `.label-tag`
- Filter items: `text-[13px] font-medium rounded-md px-3 py-2`, active = `bg-primary-muted text-primary`

### Section Headers
```jsx
<p className="label-tag mb-2">{tag}</p>
<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
<p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
```
"See all" link: `text-[12px] font-semibold uppercase tracking-wider text-primary`

### Chips / Pills / Tags
- **Category chip**: `rounded-full border border-border bg-card px-3.5 py-2 text-[12px] font-semibold`
- **Listing type badge**: `rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider`
- **Status badge**: `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase`
- Never use rounded-2xl for chips — always rounded-full or rounded-sm

### Seasonal Banner
```
rounded-xl border border-surge/20 bg-surge-surface
```
Headline: `font-display italic font-bold text-[17px] text-surge-foreground`
Used for semester event alerts only. Max one per page.

### Green CTA Banner (Homedine pattern)
Full-width section with `bg-primary text-primary-foreground rounded-xl`, used once per page (home page "pass it on" section). Headline uses `font-display italic`.

### Reviews Panel
Background: `bg-surface` (warm, not pure white card). Creates the "warm cream review section" feel from Homedine.

### Footer
Multi-column with `.label-tag` for group headers. Background: `bg-surface`. Large italic wordmark on the left (desktop). No heavy visual treatment.

---

## Motion

All animations are subtle and purposeful. 150–250ms. No bounce, no parallax, no slide-in cascades.

| Element | Animation |
|---|---|
| Cards | `.hover-lift` → `translateY(-2px)` + soft shadow, 150ms ease |
| Category icon on hover | Color swap to primary, 150ms |
| Nav links | Color transition, instant |
| Input focus | `ring-2 ring-primary/10`, instant |
| Image on card hover | `scale(1.03)`, 300ms ease |
| Brand logo | `scale(1.05)` on group hover, 200ms |

```css
/* defined in globals.css */
.hover-lift {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px oklch(0.36 0.095 148 / 0.08);
}
```

---

## Copy Guidelines

**Voice:** Clear, not clever. Warm but efficient. Circular economy framing.

| Context | Write | Avoid |
|---|---|---|
| Hero headline | "The student market for everything campus life needs." | "Unlock your potential on campus" |
| Listing type | "For sale" / "For rent" | "BUY" / "HIRE" |
| Deposit | "+฿500 deposit" | "Security deposit of ฿500 required" |
| Escrow | "Deposit held in escrow until return" | "Payment secured by platform" |
| Trust | "AIT email verified" | "Verified user" |
| CTA | "Pass it on, don't throw it away" | "Post your item today!" |
| Sustainability | "Circulated 3× within AIT" | "Used" or "Second-hand" |

---

## Do / Don't

### Do
- Use `bg-surface` / `bg-surface-tinted` for raised panels and image backgrounds
- Use `.label-tag` for all section labels and group headers
- Use `font-display italic` sparingly — one or two words per screen maximum
- Use `rounded-xl` for cards and containers, `rounded-full` for pills, `rounded-md` for buttons and inputs
- Use `text-[13px]` as the standard body text size (not `text-sm` which is 14px)
- Add `.hover-lift` to all clickable cards
- Keep `text-muted-foreground` for secondary text; never raw gray utilities

### Don't
- No purple, blue, or gradient UI elements
- No gradient text or gradient buttons
- No emojis in the UI
- No `rounded-2xl` or `rounded-3xl` on components (removed in this redesign)
- No hardcoded hex values in component files
- No centered-everything hero layouts — use deliberate left alignment
- No "hero + three identical feature cards" template
- No overuse of chips, badges, containers — not everything needs a box
- No `font-display` on section headings (only Inter/Instrument Sans for those)
- No pure `#FFFFFF` backgrounds or `#000000` text — use tokens
- No heavy shadows — thin border + subtle lift only
- Don't use `bg-secondary/30` — use `bg-surface` instead

---

## Files Changed in This Redesign

| File | Change |
|---|---|
| `app/globals.css` | Full rewrite: new OKLCH palette, 8px base radius, Instrument Sans font var, added `surface` + `surface-tinted` + `primary-muted` tokens, `.label-tag` + `.hover-lift` utilities |
| `app/layout.tsx` | Swapped Inter → Instrument Sans, kept Playfair Display |
| `components/site-header.tsx` | Thin `h-14` header, wordmark as italic serif, uppercase tracking-widest nav links, no announcement bar |
| `components/home-hero.tsx` | Asymmetric two-column layout, stats strip panel, trust strip (flat, no containers), search uses `rounded-md` not `rounded-full` |
| `components/listing-card.tsx` | `bg-surface-tinted` image bg, `rounded-xl` card, `rounded-sm` type badge, Playfair Display price |
| `components/category-grid.tsx` | Horizontal scroll on mobile, pill chip pattern |
| `components/section-header.tsx` | `.label-tag` + non-display heading, "See all" uppercase |
| `components/seasonal-banner.tsx` | `bg-surge-surface` with `border-surge/20`, italic headline |
| `components/why-section.tsx` | Asymmetric grid (first card dark green), flat pricing table |
| `app/page.tsx` | Added green CTA banner, multi-column footer, removed blob decorations |
| `app/browse/page.tsx` | Two-column layout with left sidebar filters (Moss pattern), mobile filter toggle |
| `app/listing/[id]/page.tsx` | Breadcrumb nav, `bg-surface` reviews panel, `bg-surface-tinted` image bg |
| `app/sell/page.tsx` | Cleaner form, `rounded-xl` option cards, `label-tag` labels |
| `app/chat/page.tsx` | `rounded-xl` shell, `bg-surface` message bg, `rounded-md` message input |
| `app/needs/page.tsx` | Header with `label-tag`, `rounded-xl` cards |
| `app/rentals/page.tsx` | Header with `label-tag`, `rounded-xl` rental cards, `bg-surface-tinted` image |
| `components/rent-checkout-dialog.tsx` | `bg-surface` fee table, `bg-surge-surface` escrow note |

---

## Changelog

### 2026-10-07 — Full visual redesign
- **Design direction:** Minimalist, earthy, campus-grounded. Deep forest green + warm cream + muted terracotta. No purple/blue/gradient/glassmorphism.
- **Fonts:** Switched body font from Inter to Instrument Sans. Kept Playfair Display as a sparingly-used serif accent.
- **Radius:** Reduced base from 14px to 8px. Removed `rounded-2xl`/`rounded-3xl` from components. Cards → `rounded-xl`, buttons → `rounded-md`, pills → `rounded-full`.
- **Colors:** Added `surface`, `surface-tinted`, `primary-muted`, `surge-surface` tokens. Removed reliance on `bg-secondary/30` opacity hacks.
- **Layout:** Home page → asymmetric two-column hero + stats panel. Browse → Moss-style left sidebar filters. Listing detail → breadcrumb + image-led layout.
- **Typography:** Replaced `font-display` on section headings with `font-semibold tracking-tight`. Playfair Display reserved for: wordmark, serif italic accent words, prices.
- **Removed:** Blob decorations, pill-shaped search bars on main forms, `rounded-3xl` cards, announcement bar.

---

## Pass 2 — Zara/H&M Layout Overhaul (2026-10-07)

### Layout Principles (updated)

**Before:** Dashboard feel — large left sidebar, big "Browse" title block, boxy padded cards.
**After:** Retail storefront feel — products immediately visible, image-first, minimal metadata.

| Principle | Implementation |
|---|---|
| Products first | Filter bar is `h-10` (thin), products appear right below the header |
| Image-first | Product card: 3:4 image, no border, no shadow, text floats below |
| Consistent container | `max-w-7xl` across all pages (was `max-w-6xl`) |
| Generous but tight grid | `gap-x-3 gap-y-8` — tight horizontal, generous vertical |

### Header Spec (updated)

```
[Announcement bar — bg-primary, 11px, dismissible]
[Header — h-12, sticky, border-b]
  [Wordmark italic 14px] [Category nav — 11px uppercase tracked] [→ spacer →]
  [Search icon] [Heart icon + badge] [Message icon + badge] [My listings] [List btn] [Avatar]
```

- Announcement bar: bg-primary, text-primary-foreground, 11px, dismissible (X button)
- Category links: uppercase, tracking-widest, 11px — match nav text from prev pass
- Search: triggers overlay input, does NOT live persistently in header
- "List" button: `bg-primary rounded-sm px-3 py-1.5 text-[11px] uppercase tracking-wider`
- Mobile: hamburger → right slide-out drawer

### Product Card Spec (Zara style)

```
article.group
  ├── div.relative.overflow-hidden.bg-surface-tinted
  │   ├── Link [aspect-[3/4]] → image or ImagePlaceholder
  │   ├── [status badge bottom-left] — only when unavailable
  │   └── [heart button top-right] — opacity-0 on desktop, shows on group-hover
  └── div.mt-2.space-y-0.5
      ├── h3 — item name, line-clamp-1, 13px font-medium
      ├── p — price 13px font-semibold [+ rental period in muted]
      └── p — Condition · Pickup (shortened), 11px muted
```

**No:** card border, card shadow, card padding container, colored badges, category label, deposit on card, repeat-rental counter, location in full.
**Yes:** 3:4 ratio, image scale on hover (1.03), heart toggle, status text only when unavailable.

### Image Placeholder Rules

- Used when: `images[0]` is missing, is `/placeholder.svg`, or ends in `.svg`
- Appearance: `bg-surface-tinted` (pale sage) with a single thin-line category icon at 30% opacity
- Do NOT use cartoon illustrations (kettle.svg, bikelock.svg are replaced by this)
- Icon strokeWidth: 1.25 (thinner than default 2)

### Filter Bar Spec (H&M style)

```
div.sticky.top-12.z-30.border-b.bg-background [h-10]
  ├── Chip[Type] Chip[Category] Chip[Condition] Chip[Location]
  ├── [All filters button] → slide-over drawer
  ├── [Clear] — only when filters active
  ├── [spacer]
  ├── [N items count]
  └── [Sort select]
```

- Chips: `h-8 rounded-sm border text-[11px] uppercase tracking-wider`
- Active chip: `border-foreground bg-foreground text-background` (inverted — solid)
- Inactive chip: `border-border text-muted-foreground`
- Slide-over drawer: right side, radio-style options, reset + apply footer
- Replace: permanent left sidebar (removed)

### Detail Page Spec

```
[Breadcrumb — 11px]
grid lg:grid-cols-[1fr_380px]
  Left: [main image 3:4] [thumbnails row if >1] [Accordions]
  Right (sticky): [label-tag type] [h1 title] [price] [escrow note] [CTAs]
                  [quick facts: condition, location, history]
                  [seller block + rating + "see all" link]
```

- Accordions: About, Rental terms (rent only), Condition & history, Pickup
- Image bg: `bg-surface-tinted` (no white flash on load)
- No colored type badge on main image — label-tag in info panel instead
- Reviews: grid layout (2→3 col), no bordered card, text + avatar + rating inline

### My Listings Page Spec

```
[Page header: "My listings" + count + "List item" button]
[Status tabs: All | Active | Rented out | Sold | Paused] — underline indicator
[Listing rows: divided list, no card border]
  [80×64px thumbnail] [title, price, type·date, status badge, thread alert]
  [View | Pause/Republish buttons] [overflow menu: ...]
[Empty state per tab]
[Delete confirmation: Dialog]
```

- Status tab active: underline `after:` pseudo-element on tab button
- Status colors: Available = text-primary, Rented = text-surge-foreground, Sold/Paused = muted
- Per-item quick actions (visible on sm+): View, Pause/Republish
- Overflow menu: View, Edit, Pause/Republish, Mark as sold, View messages, [divider] Delete
- Delete: Dialog with `variant="destructive"` confirm button
- Empty state per tab: icon, contextual message, "List your first item" only on All tab

### Grid Breakpoints (updated)

| Breakpoint | Columns | Container |
|---|---|---|
| Mobile (< 640px) | 2 | max-w-7xl |
| Tablet (640–1024px) | 3 (`sm:grid-cols-3`) | max-w-7xl |
| Desktop (≥ 1024px) | 4 (`lg:grid-cols-4`) | max-w-7xl |

Gap: `gap-x-3 gap-y-8` (tight horizontal, breathing vertical)

### Updated Do / Don't

**Do:**
- Use `aspect-[3/4]` for all product images
- Use `bg-surface-tinted` for image placeholder backgrounds
- Use `ProductCard` (not `ListingCard`) — renamed in Pass 2
- Use `max-w-7xl` for page containers (not max-w-6xl)
- Use `rounded-sm` for buttons and chips (not rounded-md — more editorial)
- Keep filter chips to `h-8` max height — they must fit in the 40px filter bar
- Use `no-scrollbar` for horizontal scroll containers on mobile

**Don't:**
- Don't put colored `bg-primary/85` or `bg-surge/85` badges on product images
- Don't show deposit, category, or repeat counter on product cards
- Don't use `rounded-xl` for buttons (Pass 2 switched to `rounded-sm` for Zara aesthetic)
- Don't use a permanent left sidebar for filters
- Don't put a search box inside the browse area (search is in header only)
- Don't use `ListingCard` (component renamed to `ProductCard`)

---

## Pass 3 — E-Commerce Visual Overhaul & PassItOn Rebrand (2026-10-07)

**Problem:** The app felt like an admin dashboard, not a storefront.
**Fix:** Full-bleed branded hero, category tab strip, enriched page headers, and a brand CTA banner.

### Key Changes

| Area | Before | After |
|---|---|---|
| App name | AIT Circular / AIT Circular Marketplace | **PassItOn** / PassItOn — Student Marketplace |
| Logo | Text wordmark `font-display italic` | SVG logo files from `/public/logo/` (light + reversed for dark mode) |
| Home hero | Plain search box + `\|`-separated category links | Full-bleed deep green hero banner with PassItOn mark, headline, trust stats |
| Category navigation | Inline text links | Underline-tab strip between hero and filter bar |
| Page headers | `text-lg` H1 with thin border | `label-tag` eyebrow + `text-2xl sm:text-3xl` H1 + descriptive subtitle |
| Announcement bar | Generic campus notice | Branded "PassItOn" message, links to `/sell` |
| Footer copyright | "AIT Circular Marketplace" | "PassItOn" |
| Escrow strip (Rentals) | Flat border-b line | `rounded-xl bg-primary-muted` card with larger number |
| Hero CTA banner | None | Green `bg-primary rounded-xl` "Pass it on" banner before footer |
| Header height | `h-12` (48px) | `h-14` (56px) — taller, more premium feel |
| Filter bar sticky offset | `top-12` | `top-14` (matches taller header) |
| hover-lift shadow | `0 6px 20px` at 8% | `0 8px 24px` at 10% (slightly stronger lift) |

### Hero Banner Spec

```
[bg-primary full-bleed with dot-grid texture overlay at 4% opacity]
  [PassItOn mark (passiton-mark.svg) + eyebrow label: "Asian Institute of Technology"]
  [H1 headline — primary-foreground, serif italic on 'everything']
  [Sub copy — primary-foreground/70]
  [CTAs: "Browse items" (inverted bg) + "Rent for a semester" (border outline)]
  [Right: stats panel — active count | avg rating | verified %]
```

### Category Tab Strip Spec

```
[border-b bg-background — sits between hero and sticky filter bar]
  [Overflow-x scroll, no-scrollbar]
  ['All' tab + one tab per CATEGORY]
  [Active: border-b-2 border-foreground text-foreground]
  [Inactive: border-b-2 border-transparent text-muted-foreground hover:text-foreground]
```

### Page Header Spec (all non-home pages)

```jsx
<p className="label-tag mb-2">{context}</p>  // "My account" | "Incoming students" | "PassItOn marketplace"
<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
<p className="mt-2 text-[14px] text-muted-foreground">{description}</p>
```

Context tags by page:
- My Listings, Rentals, Messages → `"My account"`
- Needs → `"Incoming students"`
- Sell → `"PassItOn marketplace"`

### New CSS Utility

```css
.dot-grid {
  background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
  background-size: 24px 24px;
}
```

Used only on the hero banner at ~4% opacity for subtle texture depth. Never on content areas.

### Updated Logo Usage

| Context | File | Size |
|---|---|---|
| Site header (desktop + mobile drawer) | `passiton-logo.svg` / `passiton-logo-reversed.svg` | `h-7` |
| Footer | `passiton-logo.svg` / `passiton-logo-reversed.svg` | `h-8` |
| Hero banner (mark only) | `passiton-mark.svg` | `h-9 opacity-80` |
| App favicon | `app/icon.svg` (two-circle mark recreation) | 64×64 |

Dark mode: always swap `.svg` → `-reversed.svg` via `dark:hidden` / `hidden dark:block` class pair.
