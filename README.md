# AIT Circular Marketplace (Buy, Sell & Rent)

Skeleton UI prototype for a C2B2C circular marketplace exclusive to students of the
Asian Institute of Technology. It exists to make the proposal tangible: every screen
runs on in-memory mock data, nothing is persisted, and payments are simulated.

## The idea in one paragraph

AIT's international student population turns over on a fixed academic calendar.
Every intake, new students furnish a room from scratch; every outtake, departing
students offload furniture, electronics, bikes, textbooks and kitchen gear. Today
that happens in scattered Facebook groups and LINE chats where posts get buried,
nothing is searchable, and nobody can hold a deposit. This platform gives students
one structured place to buy, sell and **rent**, matches outgoing listings to incoming
needs around the known semester dates, and makes renting viable by holding deposits
in escrow and handling disputes.

## What the prototype shows

| Route | Proposal feature |
| --- | --- |
| `/` | Hero, seasonal move-out / new-arrival surge banner, category grid, "why not a Facebook group" section, money angle |
| `/browse` | Category, search, sale vs. rent, price sort; premium placements float first |
| `/listing/[id]` | Photos, condition, campus pickup, item lifecycle history, seller rating and reviews, campus-shop badge |
| `/sell` | Listing creation (sale or rent), deposit, pickup location, fee explanation, premium placement toggle |
| `/needs` | Pre-arrival need registration, auto-matched against available listings |
| `/chat` | In-platform private chat per listing (replies are canned) |
| `/rentals` | Deposit escrow lifecycle: active, return pending, released, disputed |

Renting an item opens a checkout that itemises the rental fee, the 10% platform
commission, the flat escrow handling fee and the refundable deposit, then places the
deposit in escrow and opens a chat with the owner. Fee constants live in
`lib/fees.ts`.

Two demo sellers are campus shops (the "B" in C2B2C) listing new stock and a rental
fleet next to student listings.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # fee quote unit tests (node --test)
npm run lint
npm run build
```

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4 and shadcn/ui on Base UI.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Go to <https://vercel.com/new>, import the repository and accept the detected
   Next.js defaults. No environment variables are needed.
3. Every push to the production branch redeploys automatically.

## Not built yet

- Real accounts verified through AIT student email
- A database; all state is seeded from `lib/data.ts` and lives in React context
- Real payments and escrow (PromptPay, cards, wallet payouts)
- Photo uploads to storage; the sell form only previews local files
- Notifications for calendar-based matches
