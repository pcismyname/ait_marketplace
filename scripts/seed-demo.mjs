#!/usr/bin/env node
// Seed demo accounts and data into the LOCAL Supabase stack.
//
//   npm run seed:demo                 (local only; reads .env.development.local)
//   node scripts/seed-demo.mjs --production   (refused unless you pass this flag)
//
// Creates owner / renter / buyer / seller / admin accounts at @ait.asia with
// the admin API (email_confirm: true, so no email is sent), marks the admin,
// loads the sample listings from lib/data.ts and drives a few rentals and
// purchases into different states through the real RPCs. Credentials are
// written to demo-accounts.local.md (git-ignored). Re-running resets the demo
// accounts' deals and gives them new passwords.
//
// Uses SUPABASE_SECRET_KEY (server-side only). Never put that key in client
// code or in a NEXT_PUBLIC_ variable.

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(root, '.env.development.local')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const production = process.argv.includes('--production')
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !secretKey || !publishableKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY (see docs/Database.md).')
  process.exit(1)
}
const host = new URL(url).hostname
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !production) {
  console.error(`Refusing to seed ${url}: it is not a local Supabase. Pass --production only if you really mean it.`)
  process.exit(1)
}
if (production) console.warn(`⚠ Seeding NON-LOCAL project ${url} (--production).`)

const { LISTINGS, NEEDS, USERS, SELLER_REVIEWS } = await import('../lib/data.ts')

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

// ─── Accounts ────────────────────────────────────────────────────────────────

const ACCOUNTS = [
  { role: 'owner', email: 'demo.owner@ait.asia', persona: 'u_kwame', note: 'Owns the rental listings; approves requests, confirms returns.' },
  { role: 'renter', email: 'demo.renter@ait.asia', persona: 'u_sara', note: 'Rents items; has bookings in several states.' },
  { role: 'seller', email: 'demo.seller@ait.asia', persona: 'u_mai', note: 'Owns the sale listings.' },
  { role: 'buyer', email: 'demo.buyer@ait.asia', persona: 'u_linh', note: 'Buys items in person and with protection.' },
  { role: 'admin', email: 'demo.admin@ait.asia', persona: null, note: 'Platform admin: resolves disputes, can time-travel deals.' },
]

const password = () => `PassItOn-${randomBytes(9).toString('base64url')}`

async function findAuthUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 200) return null
  }
  return null
}

const accounts = {}
for (const account of ACCOUNTS) {
  const persona = USERS.find((u) => u.id === account.persona)
  const name = persona?.name ?? 'Pass It On Admin'
  const pw = password()
  const metadata = { name, program: persona?.program ?? 'Pass It On team', batch: persona?.batch ?? 'Staff' }
  let user = await findAuthUser(account.email)
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, { password: pw, email_confirm: true, user_metadata: metadata })
    if (error) throw error
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password: pw, email_confirm: true, user_metadata: metadata })
    if (error) throw error
    user = data.user
  }
  const { error } = await admin.from('users').upsert({
    id: user.id,
    name,
    email: account.email,
    program: metadata.program,
    batch: metadata.batch,
    kind: 'student',
    is_admin: account.role === 'admin',
    rating: persona?.rating ?? 0,
    reviews_count: persona?.reviewsCount ?? 0,
    onboarded_at: new Date().toISOString(),
  })
  if (error) throw error
  accounts[account.role] = { ...account, id: user.id, name, password: pw }
  console.log(`✓ ${account.role.padEnd(6)} ${account.email}`)
}
const demoIds = Object.values(accounts).map((a) => a.id)

// ─── Reset the demo accounts' deals ─────────────────────────────────────────

const uuidFor = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const listingIds = new Map(LISTINGS.map((l, i) => [l.id, uuidFor(1000 + i)]))
const demoListingIds = [...listingIds.values()]

async function must(promise, what) {
  const { error } = await promise
  if (error) throw new Error(`${what}: ${error.message}`)
}

const { data: oldRentals } = await admin.from('rentals').select('id').or(`renter_id.in.(${demoIds}),owner_id.in.(${demoIds})`)
const { data: oldTx } = await admin.from('transactions').select('id').or(`buyer_id.in.(${demoIds}),seller_id.in.(${demoIds})`)
const oldRentalIds = (oldRentals ?? []).map((r) => r.id)
const oldTxIds = (oldTx ?? []).map((t) => t.id)
if (oldRentalIds.length) await must(admin.from('wallet_ledger').delete().in('rental_id', oldRentalIds), 'clear rental ledger')
if (oldTxIds.length) await must(admin.from('wallet_ledger').delete().in('transaction_id', oldTxIds), 'clear sale ledger')
await must(admin.from('wallet_ledger').delete().in('user_id', demoIds), 'clear wallets')
await must(admin.from('notifications').delete().in('user_id', demoIds), 'clear notifications')
await must(admin.from('reviews').delete().in('listing_id', demoListingIds), 'clear reviews')
if (oldRentalIds.length) await must(admin.from('rentals').delete().in('id', oldRentalIds), 'clear rentals')
if (oldTxIds.length) await must(admin.from('transactions').delete().in('id', oldTxIds), 'clear purchases')
await must(admin.from('threads').delete().in('listing_id', demoListingIds), 'clear threads')
await must(admin.from('listing_history').delete().in('listing_id', demoListingIds), 'clear history')
await must(admin.from('needs').delete().in('user_id', demoIds), 'clear needs')

// ─── Listings, history, reviews, needs ──────────────────────────────────────

for (const [index, listing] of LISTINGS.entries()) {
  const id = listingIds.get(listing.id)
  const seller = listing.type === 'rent' ? accounts.owner : accounts.seller
  await must(admin.from('listings').upsert({
    id,
    seller_id: seller.id,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    type: listing.type,
    price: listing.price,
    deposit: listing.deposit ?? null,
    rental_period: listing.rentalPeriod ?? null,
    condition: listing.condition,
    images: listing.images,
    pickup_location: listing.pickupLocation,
    status: 'available',
    times_changed_hands: listing.timesChangedHands,
    featured: listing.featured ?? false,
    view_count: listing.viewCount ?? 0,
    created_at: listing.createdAt,
  }), `listing ${listing.title}`)
  if (listing.history.length) {
    await must(admin.from('listing_history').insert(listing.history.map((h, i) => ({
      id: uuidFor(6000 + index * 100 + i), listing_id: id, owner_name: h.ownerName, action: h.action, date: h.date,
    }))), `history ${listing.title}`)
  }
  const reviews = SELLER_REVIEWS[listing.sellerId] ?? []
  if (reviews.length) {
    await must(admin.from('reviews').insert(reviews.map((r, i) => ({
      id: uuidFor(7000 + index * 100 + i), listing_id: id, author_id: accounts.buyer.id, subject_id: seller.id,
      author_name: r.authorName, author_avatar: r.authorAvatar || null, role: r.role, rating: r.rating,
      comment: r.comment || null, date: r.date,
    }))), `reviews ${listing.title}`)
  }
}
console.log(`✓ ${LISTINGS.length} listings`)

// Rating and review count come from the review rows (as submit_review does),
// not from the persona's display numbers.
for (const account of Object.values(accounts)) {
  const { data: rows, error } = await admin.from('reviews').select('rating').eq('subject_id', account.id)
  if (error) throw new Error(`count reviews: ${error.message}`)
  const count = rows.length
  const rating = count ? Math.round((rows.reduce((sum, r) => sum + Number(r.rating), 0) / count) * 10) / 10 : 0
  await must(admin.from('users').update({ rating, reviews_count: count }).eq('id', account.id), 'rating')
}

// Needs are dated for the next intake (6 Jan 2027) so they are open and show
// matches; the sample data's 'August 2026' would already be closed.
const NEXT_INTAKE = { label: 'January 2027', date: '2027-01-06' }
await must(admin.from('needs').insert(NEEDS.map((n, i) => ({
  id: uuidFor(4000 + i), user_id: accounts.renter.id, title: n.title, category: n.category,
  note: n.note?.replace(/August/g, 'January') ?? null,
  arrival_date: NEXT_INTAKE.label, needed_by: NEXT_INTAKE.date, listing_type: 'any', created_at: n.createdAt,
}))), 'needs')

// ─── Deals in different states, through the real RPCs ───────────────────────

async function signIn(account) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  if (error) throw new Error(`sign in ${account.email}: ${error.message}`)
  return client
}
const as = {
  owner: await signIn(accounts.owner),
  renter: await signIn(accounts.renter),
  seller: await signIn(accounts.seller),
  buyer: await signIn(accounts.buyer),
  admin: await signIn(accounts.admin),
}
async function rpc(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}
const L = (key) => listingIds.get(key)

// Fridge: a request waiting for the owner.
await rpc(as.renter, 'request_rental', { p_listing_id: L('l_fridge'), p_message: 'Could I pick it up on Friday afternoon?' })
await rpc(as.renter, 'start_thread', { p_listing_id: L('l_fridge'), p_other_user_id: accounts.owner.id, p_text: 'Hi! I just requested your mini fridge. Is Friday OK?' })

// Cookware: approved, waiting for the renter to pay.
const cookware = await rpc(as.renter, 'request_rental', { p_listing_id: L('l_cookware') })
await rpc(as.owner, 'respond_rental', { p_rental_id: cookware.id, p_approve: true })

// Badminton: one finished rental (released, owner paid), then a new one that is overdue.
let badminton = await rpc(as.renter, 'request_rental', { p_listing_id: L('l_badminton') })
await rpc(as.owner, 'respond_rental', { p_rental_id: badminton.id, p_approve: true })
await rpc(as.renter, 'pay_rental', { p_rental_id: badminton.id, p_method: 'promptpay' })
await rpc(as.owner, 'confirm_handover', { p_rental_id: badminton.id })
await rpc(as.admin, 'admin_time_travel', { p_id: badminton.id, p_hours: 24 * 6 })
await rpc(as.renter, 'mark_returned', { p_rental_id: badminton.id })
await rpc(as.owner, 'confirm_return', { p_rental_id: badminton.id })
badminton = await rpc(as.renter, 'request_rental', { p_listing_id: L('l_badminton') })
await rpc(as.owner, 'respond_rental', { p_rental_id: badminton.id, p_approve: true })
await rpc(as.renter, 'pay_rental', { p_rental_id: badminton.id, p_method: 'card' })
await rpc(as.owner, 'confirm_handover', { p_rental_id: badminton.id })
await rpc(as.admin, 'admin_time_travel', { p_id: badminton.id, p_hours: 24 * 32 }) // 30-day rental, 2 days late

// Kettle: returned, owner reports damage → open dispute for the admin queue.
const kettle = await rpc(as.renter, 'request_rental', { p_listing_id: L('l_kettle') })
await rpc(as.owner, 'respond_rental', { p_rental_id: kettle.id, p_approve: true })
await rpc(as.renter, 'pay_rental', { p_rental_id: kettle.id, p_method: 'card' })
await rpc(as.renter, 'confirm_handover', { p_rental_id: kettle.id })
await rpc(as.renter, 'mark_returned', { p_rental_id: kettle.id })
await rpc(as.owner, 'file_dispute', {
  p_rental_id: kettle.id, p_reason: 'Damage', p_description: 'The lid hinge is cracked; it was fine at handover.', p_claim_amount: 150,
})

// Sales.
const desk = await rpc(as.buyer, 'create_sale', { p_listing_id: L('l_desk'), p_mode: 'protected', p_method: 'promptpay' })
await rpc(as.seller, 'confirm_sale_handover', { p_transaction_id: desk.id })
await rpc(as.buyer, 'start_thread', { p_listing_id: L('l_desk'), p_other_user_id: accounts.seller.id, p_text: 'Got the desk, thanks! Checking it tonight.' })

await rpc(as.buyer, 'create_sale', { p_listing_id: L('l_bike'), p_mode: 'protected', p_method: 'card' })

const lamp = await rpc(as.buyer, 'create_sale', { p_listing_id: L('l_lamp'), p_mode: 'protected', p_method: 'promptpay' })
await rpc(as.seller, 'confirm_sale_handover', { p_transaction_id: lamp.id })
await rpc(as.buyer, 'confirm_sale_receipt', { p_transaction_id: lamp.id })

const riceCooker = await rpc(as.buyer, 'create_sale', { p_listing_id: L('l_ricecooker'), p_mode: 'protected', p_method: 'promptpay' })
await rpc(as.seller, 'confirm_sale_handover', { p_transaction_id: riceCooker.id })
await rpc(as.buyer, 'file_dispute', {
  p_transaction_id: riceCooker.id, p_reason: 'Not as described', p_description: 'The inner pot is scratched, not shown in the photos.', p_claim_amount: 100,
})

await rpc(as.buyer, 'create_sale', { p_listing_id: L('l_monitor'), p_mode: 'in-person' })

const jobs = await rpc(as.admin, 'run_escrow_jobs')
console.log('✓ deals seeded; escrow jobs:', JSON.stringify(jobs))

// ─── Credentials file ───────────────────────────────────────────────────────

const lines = [
  '# Pass It On — demo accounts (LOCAL)',
  '',
  `Generated ${new Date().toISOString()} by \`npm run seed:demo\` for ${url}.`,
  'Git-ignored (`*.local.md`). Re-running the script resets these accounts\' deals and changes the passwords.',
  '',
  '| Role | Email | Password | Name | What to try |',
  '|---|---|---|---|---|',
  ...Object.values(accounts).map((a) => `| ${a.role} | ${a.email} | \`${a.password}\` | ${a.name} | ${a.note} |`),
  '',
  '## Seeded state',
  '',
  '- Mini fridge: rental **requested** by the renter (owner can approve or decline).',
  '- Cookware set: rental **approved**, waiting for the renter to pay.',
  '- Badminton set: one rental **released** (owner paid, deposit refunded to the renter wallet), a second one **overdue** (2 days late).',
  '- Kettle: rental returned and **disputed** by the owner (damage).',
  '- Desk: protected sale **handed over** (48 h window open). Bike: protected sale **paid**, awaiting handover.',
  '- Desk lamp: protected sale **released**. Rice cooker: protected sale **disputed** by the buyer.',
  '- Monitor: in-person purchase **pending**; the seller can mark it sold.',
  '',
  'Admin tip: `admin_time_travel(<deal id>, <hours>)` then `run_escrow_jobs()` shows payouts and auto-release without waiting.',
  '',
]
writeFileSync(path.join(root, 'demo-accounts.local.md'), lines.join('\n'))
console.log('✓ credentials written to demo-accounts.local.md')
