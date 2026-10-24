#!/usr/bin/env node
// End-to-end rental flow against the LOCAL Supabase API, as two real users:
//   request → approve → pay → handover → (48 h later) owner payout → return → release
// plus a protected sale. Uses the same publishable-key API calls as the app
// (the RPCs behind lib/api), so it proves the browser contract works.
//
//   npm run demo:flow
//
// Creates two throw-away @ait.asia users with the admin API (secret key),
// prints each step, checks the money, and deletes the users afterwards.

import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(root, '.env.development.local')
if (existsSync(envFile)) process.loadEnvFile(envFile)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !publishableKey || !secretKey) {
  console.error('Missing local Supabase settings in .env.development.local (see docs/Database.md).')
  process.exit(1)
}
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  console.error(`Refusing to run against ${url}: local Supabase only.`)
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secretKey, opts)
const tag = randomBytes(3).toString('hex')
const created = []

async function newUser(label) {
  const email = `flow.${label}.${tag}@ait.asia`
  const password = `Flow-${randomBytes(9).toString('base64url')}`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: `Flow ${label}` },
  })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(url, publishableKey, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, email, client }
}

async function rpc(user, fn, args = {}) {
  const { data, error } = await user.client.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

async function wallet(user) {
  const [row] = await rpc(user, 'get_wallet_summary')
  return row
}

const step = (n, text) => console.log(`${String(n).padStart(2)}. ${text}`)

try {
  // Signing up with another domain is refused.
  const { error: gmail } = await createClient(url, publishableKey, opts).auth.signUp({
    email: `flow.${tag}@gmail.com`, password: 'not-an-ait-email',
  })
  assert.ok(gmail, 'a gmail signup must be refused')
  step(0, `gmail signup refused: "${gmail.message}"`)

  const owner = await newUser('owner')
  const renter = await newUser('renter')

  // The owner lists a mini fridge (direct insert, as the sell form does).
  const listingId = randomUUID()
  const { error: listingError } = await owner.client.from('listings').insert({
    id: listingId, seller_id: owner.id, title: `Flow mini fridge ${tag}`, description: 'Quiet, cold',
    category: 'electronics', type: 'rent', price: 250, deposit: 800, rental_period: 'per semester',
    condition: 'good', pickup_location: 'Dorm A Lobby',
  })
  if (listingError) throw listingError
  step(1, 'owner listed a ฿250 / semester fridge with a ฿800 deposit')

  let rental = await rpc(renter, 'request_rental', { p_listing_id: listingId, p_message: 'Friday pickup?' })
  assert.equal(rental.phase, 'requested')
  assert.equal(rental.quote.totalDueNow, 1105)
  step(2, `renter requested it → ${rental.phase}, quote ฿${rental.quote.totalDueNow}`)

  const { data: ownerNotes } = await owner.client.from('notifications').select('kind, title')
  assert.ok(ownerNotes.some((n) => n.kind === 'rental_requested'))
  step(3, `owner notified: "${ownerNotes.find((n) => n.kind === 'rental_requested').title}"`)

  const { error: directWrite } = await renter.client.from('rentals').update({ phase: 'released' }).eq('id', rental.id)
  assert.ok(directWrite, 'direct writes to rentals must be refused')
  step(4, `renter cannot write the rental directly ("${directWrite.message}")`)

  rental = await rpc(owner, 'respond_rental', { p_rental_id: rental.id, p_approve: true })
  assert.equal(rental.phase, 'approved')
  step(5, `owner approved → ${rental.phase}`)

  rental = await rpc(renter, 'pay_rental', { p_rental_id: rental.id, p_method: 'promptpay' })
  assert.equal(rental.phase, 'paid')
  assert.equal(rental.total_paid, 1105)
  const renterAfterPay = await wallet(renter)
  assert.equal(renterAfterPay.deposits_held, 800)
  step(6, `renter paid ฿${rental.total_paid} by PromptPay (simulated) → ${rental.phase}; ฿${renterAfterPay.deposits_held} deposit held`)

  rental = await rpc(renter, 'confirm_handover', { p_rental_id: rental.id })
  assert.equal(rental.phase, 'active')
  step(7, `handover confirmed → ${rental.phase}, due ${rental.due_date.slice(0, 10)}`)

  // 49 hours later (moved with service-role SQL, like admin_time_travel).
  await admin.from('rentals').update({
    handover_at: new Date(Date.now() - 49 * 3600e3).toISOString(),
    payout_at: new Date(Date.now() - 3600e3).toISOString(),
  }).eq('id', rental.id)
  const jobs = await rpc(renter, 'run_escrow_jobs')
  const ownerAfterPayout = await wallet(owner)
  assert.equal(ownerAfterPayout.available, 250)
  step(8, `48 h after handover the job paid the owner ฿${ownerAfterPayout.available} (jobs: ${JSON.stringify(jobs)})`)

  rental = await rpc(renter, 'mark_returned', { p_rental_id: rental.id })
  assert.equal(rental.phase, 'return-pending')
  step(9, `renter returned it → ${rental.phase}, window until ${rental.dispute_window_ends_at.slice(0, 16)}`)

  rental = await rpc(owner, 'confirm_return', { p_rental_id: rental.id })
  assert.equal(rental.phase, 'released')
  const renterAfter = await wallet(renter)
  assert.equal(renterAfter.available, 800)
  assert.equal(renterAfter.held, 0)
  step(10, `owner confirmed good condition → ${rental.phase}; ฿${renterAfter.available} back in the renter's wallet`)

  const { data: listing } = await renter.client.from('listings').select('status').eq('id', listingId).single()
  assert.equal(listing.status, 'available')
  step(11, `listing is ${listing.status} again`)

  // Protected sale, paid from the refunded wallet balance.
  const saleId = randomUUID()
  await owner.client.from('listings').insert({
    id: saleId, seller_id: owner.id, title: `Flow desk ${tag}`, description: 'Wood', category: 'furniture',
    type: 'sale', price: 500, condition: 'good', pickup_location: 'Dorm A Lobby',
  })
  let tx = await rpc(renter, 'create_sale', { p_listing_id: saleId, p_mode: 'protected', p_method: 'wallet' })
  assert.equal(tx.total, 525)
  step(12, `protected purchase paid from the wallet: ฿${tx.price} + ฿${tx.protection_fee} → ${tx.status}`)
  tx = await rpc(owner, 'confirm_sale_handover', { p_transaction_id: tx.id })
  tx = await rpc(renter, 'confirm_sale_receipt', { p_transaction_id: tx.id })
  assert.equal(tx.status, 'released')
  const ownerFinal = await wallet(owner)
  assert.equal(ownerFinal.available, 750)
  step(13, `buyer confirmed receipt → ${tx.status}; owner wallet ฿${ownerFinal.available}`)

  console.log('\n✓ rental and protected-sale flows work end to end')
} finally {
  for (const id of created) {
    await admin.from('wallet_ledger').delete().eq('user_id', id)
    await admin.from('users').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
}
