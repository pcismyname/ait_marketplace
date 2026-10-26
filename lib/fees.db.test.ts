// Fee parity between the database and lib/fees.ts (BusinessRules §2).
// Needs the local Supabase stack: `npm run test:db`. Not part of `npm test`.
//
// Calls the public quote_rental / quote_sale RPCs over REST with the
// publishable key (read from .env.development.local unless already set) and
// compares every field with computeRentalQuote / computeSaleQuote.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { computeRentalQuote, computeSaleQuote, type SalePaymentMode } from './fees.ts'

if (existsSync('.env.development.local')) process.loadEnvFile('.env.development.local')
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

async function rpc(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key!, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn}(${JSON.stringify(args)}): HTTP ${res.status} ${await res.text()}`)
  return (await res.json()) as Record<string, unknown>
}

const PRICES = [0, 1, 5, 15, 25, 45, 50, 85, 99.5, 150, 250, 333, 1000, 1150, 1499.5, 2050, 2500, 9999]
const DEPOSITS = [0, 200, 250.5, 800, 850, 1000, 1150, 1500, 2050, 2999, 3000]

test('the local database is reachable', async () => {
  assert.ok(url && key, 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.development.local)')
  await rpc('quote_rental', { p_price: 250, p_deposit: 800 })
})

test('quote_rental matches computeRentalQuote on a grid of inputs', async () => {
  const cases = PRICES.flatMap((price) => DEPOSITS.map((deposit) => ({ price, deposit })))
  const results = await Promise.all(
    cases.map(async ({ price, deposit }) => ({
      price,
      deposit,
      db: await rpc('quote_rental', { p_price: price, p_deposit: deposit }),
      js: computeRentalQuote({ price, deposit }),
    })),
  )
  for (const { price, deposit, db, js } of results) {
    assert.deepEqual(db, { ...js }, `quote_rental(${price}, ${deposit})`)
  }
  assert.equal(results.length, PRICES.length * DEPOSITS.length)
})

test('quote_rental treats a missing deposit as zero, like lib/fees.ts', async () => {
  assert.deepEqual(await rpc('quote_rental', { p_price: 250 }), { ...computeRentalQuote({ price: 250 }) })
})

test('quote_sale matches computeSaleQuote for both modes', async () => {
  const modes: SalePaymentMode[] = ['in-person', 'protected']
  for (const mode of modes) {
    const results = await Promise.all(
      PRICES.map(async (price) => ({ price, db: await rpc('quote_sale', { p_price: price, p_mode: mode }) })),
    )
    for (const { price, db } of results) {
      assert.deepEqual(db, { ...computeSaleQuote(price, mode) }, `quote_sale(${price}, ${mode})`)
    }
  }
})

test('worked examples from BusinessRules.md', async () => {
  assert.equal((await rpc('quote_rental', { p_price: 250, p_deposit: 800 })).totalDueNow, 1105)
  const sale = await rpc('quote_sale', { p_price: 1000, p_mode: 'protected' })
  assert.equal(sale.total, 1040)
  assert.equal(sale.sellerCommission, 100)
  assert.equal(sale.sellerPayout, 900)
})
