// Owner + renter flow (BusinessRules §2, §4, §6):
//   A. request → owner approves → renter pays (fee + 10% + escrow fee + deposit)
//      → handover with photos → admin fast-forwards 49 h → owner payout
//      → return with photos → owner confirms → deposit released → rating.
//   B. a returned rental disputed by the owner and resolved by the admin as
//      repairable damage (repair cost to the owner, the rest refunded).
//   C. a returned rental nobody confirms: admin fast-forwards past the 48 h
//      window → auto-release of the deposit, plus the owner payout.

import {
  addPhotos,
  apiAs,
  createListing,
  expectText,
  expectToast,
  isMain,
  loginAs,
  photoFile,
  rpc,
  runFlow,
  selectOne,
  shot,
  waitFor,
  walletBalance,
} from './lib.mjs'

const quote = (fee, deposit) => {
  const commission = Math.round(fee * 0.1)
  const escrow = Math.max(30, Math.round(deposit * 0.03))
  return { commission, escrow, total: fee + commission + escrow + deposit }
}
const baht = (n) => `฿${n.toLocaleString('en-US')}`

const card = (page, rentalId) => page.locator(`[data-testid=rental-card][data-rental-id="${rentalId}"]`).first()
const rental = (id) => selectOne('owner', 'rentals', id)
const phaseIs = (id, phase) => waitFor(() => rental(id), (r) => r.phase === phase, { what: `phase ${phase}` })

/** Rental driven to return-pending through the RPCs (UI for these steps is covered in part A). */
async function returnedRental(listingId) {
  const r = await rpc('renter', 'request_rental', { p_listing_id: listingId })
  await rpc('owner', 'respond_rental', { p_rental_id: r.id, p_approve: true })
  await rpc('renter', 'pay_rental', { p_rental_id: r.id, p_method: 'promptpay' })
  await rpc('owner', 'confirm_handover', { p_rental_id: r.id })
  await rpc('renter', 'mark_returned', { p_rental_id: r.id })
  return r.id
}

/** Admin dashboard → Demo tools → pick the deal → fast-forward N hours (admin_time_travel + run_escrow_jobs). */
async function fastForward(admin, dealId, hours) {
  await admin.goto('/admin/dashboard')
  const select = admin.locator('[data-testid=demo-deal-select]')
  await waitFor(() => select.locator(`option[value="${dealId}"]`).count(), (n) => n > 0, { what: 'deal in the demo picker' })
  await select.selectOption(dealId)
  await admin.getByLabel('Hours to fast-forward').fill(String(hours))
  await admin.getByRole('button', { name: 'Go' }).click()
  return expectToast(admin, /Moved the rental/)
}

export async function main(flow, browser) {
  const renter = await loginAs(browser, 'renter')
  const owner = await loginAs(browser, 'owner')
  const admin = await loginAs(browser, 'admin')

  // ── A. Full lifecycle through the UI ─────────────────────────────────────
  const fee = 120
  const deposit = 300
  const q = quote(fee, deposit)
  const listing = await createListing('owner', {
    title: 'badminton set (rental)', type: 'rent', price: fee, deposit, rental_period: 'per week', category: 'sports',
  })
  let rentalId

  await flow.step('renter requests to book from the listing page', async () => {
    await renter.goto(`/listing/${listing.id}`)
    await renter.locator('[data-testid=request-to-book]').click()
    await renter.locator('#booking-message').fill('Could I pick it up after class on Friday? (E2E)')
    await renter.getByRole('button', { name: 'Send request' }).click()
    await expectToast(renter, /request/i)
    const { client, userId } = await apiAs('renter')
    const { data } = await client.from('rentals').select('*').eq('listing_id', listing.id).eq('renter_id', userId)
    rentalId = data[0].id
    if (data[0].phase !== 'requested') throw new Error(data[0].phase)
    return `requested, quote ${baht(Number(data[0].quote?.totalDueNow ?? q.total))}`
  })

  await flow.step('checkout refuses to take payment before approval', async () => {
    await renter.goto(`/listing/${listing.id}/checkout?rental=${rentalId}`)
    await expectText(renter, 'Waiting for the owner to approve')
  })

  await flow.step('owner approves on the listing requests page', async () => {
    await owner.goto(`/dashboard/listings/${listing.id}/requests`)
    await owner.getByRole('button', { name: 'Approve' }).first().click()
    await expectToast(owner, /approved/i)
    await phaseIs(rentalId, 'approved')
    const l = await selectOne('owner', 'listings', listing.id)
    return `approved, listing ${l.status}`
  })

  await flow.step(`renter pays ${baht(q.total)} = ${fee} + ${q.commission} + ${q.escrow} + ${deposit} (deposit held)`, async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, rentalId).getByRole('link', { name: /^Pay/ }).click()
    await renter.waitForURL(/\/checkout\?rental=/)
    const total = (await renter.locator('[data-testid=rent-total]').innerText()).trim()
    if (total !== baht(q.total)) throw new Error(`checkout total ${total}`)
    await renter.getByRole('button', { name: `Pay ${baht(q.total)}` }).click()
    await expectToast(renter, /Booking paid/)
    const r = await phaseIs(rentalId, 'paid')
    if (Number(r.total_paid) !== q.total) throw new Error(`total_paid ${r.total_paid}`)
    const held = await walletBalance('renter', 'held')
    return `paid ${baht(Number(r.total_paid))}; renter held balance ${baht(held)}`
  })

  await flow.step('handover needs a photo; renter confirms it with one → active', async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, rentalId).getByRole('button', { name: 'Confirm handover' }).click()
    const dialog = renter.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Confirm handover' }).click()
    await expectToast(renter, /photo/i)
    await addPhotos(renter, dialog, 1)
    await dialog.getByRole('button', { name: 'Confirm handover' }).click()
    await expectToast(renter, 'Handover confirmed')
    const r = await phaseIs(rentalId, 'active')
    const payoutHours = Math.round((new Date(r.payout_at) - new Date(r.handover_at)) / 3_600_000)
    if (payoutHours !== 48) throw new Error(`payout ${payoutHours} h after handover`)
    if (r.handover_photos.length !== 1) throw new Error(`handover photos ${r.handover_photos.length}`)
    return `due ${r.due_date.slice(0, 10)}, payout 48 h after handover`
  })

  const ownerBefore = await walletBalance('owner', 'available')
  await flow.step('admin fast-forwards 49 h → owner payout of the rental fee', async () => {
    const toast = await fastForward(admin, rentalId, 49)
    const r = await waitFor(() => rental(rentalId), (row) => Boolean(row.payout_released_at), { what: 'payout' })
    const gained = (await walletBalance('owner', 'available')) - ownerBefore
    if (gained !== fee) throw new Error(`owner wallet +${gained}`)
    if (r.phase !== 'active') throw new Error(`phase ${r.phase}`)
    return `${toast.replace(/^.*?Escrow jobs/, 'Escrow jobs')} · owner +${baht(gained)}`
  })

  await flow.step('owner sees the payout on the rental card', async () => {
    await owner.goto('/rentals?view=lending')
    await card(owner, rentalId).getByText(/paid out to your wallet/).waitFor()
  })

  await flow.step('renter marks it returned with a photo → 48 h window', async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, rentalId).getByRole('button', { name: 'Mark returned' }).click()
    const dialog = renter.getByRole('dialog')
    await addPhotos(renter, dialog, 1)
    await dialog.getByRole('button', { name: 'Mark returned' }).click()
    await expectToast(renter, 'Marked as returned')
    const r = await phaseIs(rentalId, 'return-pending')
    const hours = Math.round((new Date(r.dispute_window_ends_at) - new Date(r.returned_at)) / 3_600_000)
    if (hours !== 48) throw new Error(`window ${hours} h`)
    return 'return-pending, window 48 h'
  })

  const renterBefore = await walletBalance('renter', 'available')
  await flow.step('owner confirms a good return with a photo → deposit refunded in full', async () => {
    await owner.goto('/rentals?view=lending')
    await card(owner, rentalId).getByRole('button', { name: 'Confirm good return' }).click()
    const dialog = owner.getByRole('dialog')
    await addPhotos(owner, dialog, 1)
    await dialog.getByRole('button', { name: /Confirm & release deposit/ }).click()
    await expectToast(owner, 'Deposit released')
    const r = await phaseIs(rentalId, 'released')
    const refunded = (await walletBalance('renter', 'available')) - renterBefore
    if (Number(r.deposit_to_renter) !== deposit || refunded !== deposit) throw new Error(`refund ${refunded}`)
    const l = await selectOne('owner', 'listings', listing.id)
    return `released; renter +${baht(refunded)}; listing ${l.status}`
  })

  await flow.step('renter rates the owner from the My Rentals card', async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, rentalId).locator('[data-testid=rate-deal]').click()
    const dialog = renter.getByRole('dialog')
    await dialog.getByRole('button', { name: '4 stars' }).click()
    await dialog.getByRole('button', { name: 'Submit rating' }).click()
    await expectToast(renter, 'Thanks for the review')
    await card(renter, rentalId).getByText(/You rated/).waitFor()
    await shot(renter, 'rental-released-card')
  })

  await flow.step('the deal page shows the full timeline and amounts', async () => {
    await renter.goto(`/transaction/${rentalId}`)
    await renter.locator('[data-testid=timeline]').waitFor()
    await expectText(renter, baht(q.total))
    await shot(renter, 'rental-deal-page')
  })

  // ── B. Dispute: repairable damage ────────────────────────────────────────
  const dDeposit = 500
  const claim = 150
  const dListing = await createListing('owner', {
    title: 'rice cooker (rental, disputed)', type: 'rent', price: 200, deposit: dDeposit, rental_period: 'per month', category: 'kitchen',
  })
  const disputedId = await returnedRental(dListing.id)
  let disputeId

  await flow.step(`owner files a dispute with a ${baht(claim)} repair claim and a photo`, async () => {
    await owner.goto('/rentals?view=lending')
    await card(owner, disputedId).getByRole('link', { name: 'Open a dispute' }).click()
    await owner.waitForURL(/\/dispute\/new\?rental=/)
    await owner.locator('[data-testid=reason-trigger]').click()
    await owner.getByRole('option').first().click()
    await owner.locator('#dispute-description').fill('The lid hinge is cracked; it was fine in the handover photos. (E2E)')
    await owner.locator('#dispute-claim').fill(String(claim))
    await owner.locator('[data-testid=claim-preview]').waitFor()
    await owner.locator('[data-testid=evidence-input]').setInputFiles(photoFile('evidence.png', [180, 40, 40]))
    await owner.getByRole('button', { name: 'Freeze escrow and file dispute' }).click()
    await owner.waitForURL(/\/dispute\/(?!new)/)
    disputeId = owner.url().split('/dispute/')[1].split(/[?#]/)[0]
    await phaseIs(disputedId, 'disputed')
    return `dispute ${disputeId.slice(0, 8)}…`
  })

  await flow.step('the renter sees the open dispute', async () => {
    await renter.goto(`/dispute/${disputeId}`)
    await renter.locator('[data-testid=dispute-status]').waitFor()
    await expectText(renter, /hinge is cracked/)
  })

  const ownerBeforeB = await walletBalance('owner', 'available')
  const renterBeforeB = await walletBalance('renter', 'available')
  await flow.step(`admin resolves as repairable damage: ${baht(claim)} to the owner, ${baht(dDeposit - claim)} refunded`, async () => {
    await admin.goto('/admin/disputes')
    await admin.locator('[data-testid=dispute-queue]').waitFor()
    await admin.goto(`/admin/disputes/${disputeId}`)
    const panel = admin.locator('[data-testid=resolve-panel]')
    await panel.locator('[data-testid="finding-repairable-damage"]').click()
    await panel.locator('[data-testid=resolve-amount]').fill(String(claim))
    await panel.locator('[data-testid=resolve-preview]').getByText(baht(dDeposit - claim)).waitFor()
    await panel.getByRole('button', { name: 'Review decision' }).click()
    await panel.locator('[data-testid=confirm-resolve]').click()
    await expectToast(admin, /resolved/i)
    const r = await phaseIs(disputedId, 'resolved')
    if (Number(r.deposit_to_owner) !== claim || Number(r.deposit_to_renter) !== dDeposit - claim) {
      throw new Error(`split ${r.deposit_to_owner}/${r.deposit_to_renter}`)
    }
    const ownerGain = (await walletBalance('owner', 'available')) - ownerBeforeB
    const renterGain = (await walletBalance('renter', 'available')) - renterBeforeB
    // The owner also receives the ฿200 rental fee, which was held while disputed.
    if (renterGain !== dDeposit - claim || ownerGain < claim) throw new Error(`wallets owner +${ownerGain}, renter +${renterGain}`)
    await shot(admin, 'admin-dispute-resolved')
    return `owner +${baht(ownerGain)} (claim + rental fee), renter +${baht(renterGain)}`
  })

  await flow.step('both parties see the decision', async () => {
    await renter.goto(`/dispute/${disputeId}`)
    await renter.locator('[data-testid=dispute-decision]').waitFor()
    await owner.goto(`/dispute/${disputeId}`)
    await owner.locator('[data-testid=dispute-decision]').waitFor()
  })

  // ── C. 48 h auto-release ─────────────────────────────────────────────────
  const aDeposit = 400
  const aListing = await createListing('owner', {
    title: 'study lamp (rental, auto-release)', type: 'rent', price: 90, deposit: aDeposit, rental_period: 'per week', category: 'electronics',
  })
  const autoId = await returnedRental(aListing.id)
  const renterBeforeC = await walletBalance('renter', 'available')

  await flow.step('returned and unconfirmed: the deposit stays held during the 48 h window', async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, autoId).getByText(/to dispute/).waitFor()
    const r = await rental(autoId)
    if (r.phase !== 'return-pending' || r.payout_released_at) throw new Error(`${r.phase} payout ${r.payout_released_at}`)
  })

  await flow.step('admin fast-forwards 49 h → auto-release of the deposit and the owner payout', async () => {
    const toast = await fastForward(admin, autoId, 49)
    const r = await phaseIs(autoId, 'released')
    if (!r.payout_released_at) throw new Error('owner payout not released')
    const refunded = (await walletBalance('renter', 'available')) - renterBeforeC
    if (refunded !== aDeposit) throw new Error(`renter +${refunded}`)
    return `${toast.replace(/^.*?Escrow jobs/, 'Escrow jobs')} · renter +${baht(refunded)}`
  })
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('rental', main)
  process.exit(ok ? 0 : 1)
}
