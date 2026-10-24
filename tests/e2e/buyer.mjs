// Buyer flow (BusinessRules §2, §5): an in-person purchase the seller marks
// sold (no escrow, no fee), and a protected purchase (price + ฿10 + 3%) held
// in escrow → seller confirms handover → buyer confirms receipt → released to
// the seller at once, then the buyer rates the seller.

import {
  apiAs,
  createListing,
  expectText,
  expectToast,
  isMain,
  loginAs,
  runFlow,
  selectOne,
  shot,
  waitFor,
  walletBalance,
} from './lib.mjs'

const protectionFee = (price) => 10 + Math.round(price * 0.03)

export async function main(flow, browser) {
  const inPersonListing = await createListing('seller', { title: 'study chair (in person)', type: 'sale', price: 300, category: 'furniture' })
  const protectedListing = await createListing('seller', { title: 'rice cooker (protected)', type: 'sale', price: 500, category: 'kitchen' })
  const { client: buyerApi, userId: buyerId } = await apiAs('buyer')
  const buyer = await loginAs(browser, 'buyer')
  const seller = await loginAs(browser, 'seller')
  const latestPurchase = async (listingId) => {
    const { data } = await buyerApi.from('transactions').select('*').eq('listing_id', listingId).eq('buyer_id', buyerId)
      .order('created_at', { ascending: false }).limit(1)
    return data?.[0]
  }

  // ── In person ────────────────────────────────────────────────────────────
  let inPersonTx
  await flow.step('in person: listing page → "Buy now" → checkout shows no fee', async () => {
    await buyer.goto(`/listing/${inPersonListing.id}`)
    await buyer.getByRole('link', { name: /Buy now/ }).click()
    await buyer.waitForURL(/\/checkout/)
    await buyer.getByText('Pay in person', { exact: true }).click()
    await expectText(buyer, 'Pay the seller at handover')
    await buyer.getByRole('button', { name: 'Confirm in-person purchase' }).click()
    await expectToast(buyer, 'In-person purchase confirmed')
    inPersonTx = await waitFor(() => latestPurchase(inPersonListing.id), Boolean, { what: 'pending purchase' })
    if (inPersonTx.mode !== 'in-person' || inPersonTx.status !== 'pending') throw new Error(JSON.stringify(inPersonTx))
    if (Number(inPersonTx.protection_fee ?? 0) !== 0) throw new Error(`fee ${inPersonTx.protection_fee}`)
    return `pending, total ฿${inPersonTx.total}, no escrow`
  })

  await flow.step('in person: the seller marks it sold from the deal page', async () => {
    await seller.goto(`/transaction/${inPersonTx.id}`)
    await seller.getByRole('button', { name: /Mark as sold to/ }).click()
    await expectToast(seller, 'Marked as sold')
    const tx = await waitFor(() => selectOne('buyer', 'transactions', inPersonTx.id), (t) => t.status === 'completed', { what: 'completed' })
    const listing = await selectOne('buyer', 'listings', inPersonListing.id)
    if (listing.status !== 'sold') throw new Error(`listing ${listing.status}`)
    const { data: ledger } = await buyerApi.from('wallet_ledger').select('id').eq('transaction_id', tx.id)
    if (ledger.length) throw new Error('in-person sale wrote ledger rows')
    return 'completed, listing sold, no ledger rows'
  })

  // ── With protection ──────────────────────────────────────────────────────
  let tx
  const expectedTotal = 500 + protectionFee(500)
  await flow.step(`protected: checkout shows ฿500 + ฿${protectionFee(500)} fee = ฿${expectedTotal}`, async () => {
    await buyer.goto(`/listing/${protectedListing.id}/checkout`)
    await buyer.getByText('Pay with protection', { exact: true }).click()
    await expectText(buyer, 'Buyer protection fee')
    await buyer.getByText('Debit or credit card', { exact: true }).click()
    await buyer.getByRole('button', { name: `Pay ฿${expectedTotal.toLocaleString('en-US')}` }).click()
    await expectToast(buyer, /Payment held/)
    await buyer.waitForURL(/\/transaction\//)
    tx = await latestPurchase(protectedListing.id)
    if (tx.status !== 'paid' || Number(tx.total) !== expectedTotal || tx.payment_method !== 'card') throw new Error(JSON.stringify(tx))
    const listing = await selectOne('buyer', 'listings', protectedListing.id)
    if (listing.status !== 'reserved') throw new Error(`listing ${listing.status}`)
    await shot(buyer, 'buyer-protected-paid')
    return `paid ฿${tx.total} by card, listing reserved`
  })

  const sellerAvailableBefore = await walletBalance('seller', 'available')

  await flow.step('protected: the seller confirms the handover (48 h window opens)', async () => {
    await seller.goto(`/transaction/${tx.id}`)
    await seller.getByRole('button', { name: 'Confirm the handover' }).click()
    await seller.getByRole('button', { name: 'Confirm handover', exact: true }).click()
    await expectToast(seller, 'Handover confirmed')
    const t = await waitFor(() => selectOne('buyer', 'transactions', tx.id), (row) => row.status === 'handed-over', { what: 'handed-over' })
    return `window closes ${t.dispute_window_ends_at}`
  })

  await flow.step('protected: the buyer sees the countdown and confirms receipt → released', async () => {
    await buyer.goto(`/transaction/${tx.id}`)
    await buyer.locator('[data-testid=window-countdown], [data-testid=countdown]').first().waitFor()
    await buyer.getByRole('link', { name: /Confirm receipt/ }).click()
    await buyer.waitForURL(/\/confirm/)
    await buyer.getByRole('checkbox').check()
    await buyer.getByRole('button', { name: /Confirm & release/ }).click()
    await buyer.waitForURL(/review=1/)
    await waitFor(() => selectOne('buyer', 'transactions', tx.id), (row) => row.status === 'released', { what: 'released' })
    const listing = await selectOne('buyer', 'listings', protectedListing.id)
    if (listing.status !== 'sold') throw new Error(`listing ${listing.status}`)
    return 'released, listing sold'
  })

  await flow.step('protected: the seller is paid the full ฿500 (fee stays with the platform)', async () => {
    const after = await waitFor(() => walletBalance('seller', 'available'), (v) => v - sellerAvailableBefore === 500, { what: 'seller payout' })
    return `seller available +฿${after - sellerAvailableBefore}`
  })

  await flow.step('protected: the rating dialog opens and saves a review', async () => {
    await buyer.getByRole('dialog').waitFor()
    await buyer.getByRole('button', { name: '5 stars' }).click()
    await buyer.locator('#review-comment').fill('Smooth handover at the dorm. (E2E)')
    await buyer.getByRole('button', { name: 'Submit rating' }).click()
    await expectToast(buyer, 'Thanks for the review')
    const { data } = await buyerApi.from('reviews').select('rating').eq('transaction_id', tx.id).eq('author_id', buyerId)
    if (data.length !== 1 || Number(data[0].rating) !== 5) throw new Error(JSON.stringify(data))
  })

  await flow.step('orders page lists both purchases; the in-person one offers "Rate"', async () => {
    await buyer.goto('/dashboard/orders')
    const list = buyer.locator('[data-testid=orders-list]')
    await list.getByText(inPersonListing.title).waitFor()
    await list.getByText(protectedListing.title).waitFor()
    const row = list.locator('li').filter({ hasText: inPersonListing.title })
    await row.locator('[data-testid=rate-deal]').waitFor()
    const rated = list.locator('li').filter({ hasText: protectedListing.title })
    await rated.getByText(/You rated/).waitFor()
    await shot(buyer, 'buyer-orders')
  })
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('buyer', main)
  process.exit(ok ? 0 : 1)
}
