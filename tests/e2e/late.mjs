// Late / missing path (BusinessRules §4): a daily late fee of
// ceil(rentalFee / periodDays) is taken from the deposit; more than 7 days
// late counts as missing and the full deposit goes to the owner.
//
//   Late:    weekly rental ฿70, deposit ฿200 → ฿10/day. Admin fast-forwards so
//            it is 3 days late → overdue, the renter sees "late fee so far ฿30",
//            returns it with a photo, the owner confirms → owner ฿30, renter ฿170.
//   Missing: same terms, fast-forwarded to 9 days late → missing, the full ฿200
//            deposit to the owner, listing paused.

import {
  addPhotos,
  conditionPhotoAs,
  createListing,
  expectToast,
  isMain,
  loginAs,
  rpc,
  runFlow,
  selectOne,
  shot,
  waitFor,
  walletBalance,
} from './lib.mjs'

const FEE = 70
const DEPOSIT = 200
const PER_DAY = Math.ceil(FEE / 7)
const card = (page, id) => page.locator(`[data-testid=rental-card][data-rental-id="${id}"]`).first()
const rental = (id) => selectOne('owner', 'rentals', id)
const phaseIs = (id, phase) => waitFor(() => rental(id), (r) => r.phase === phase, { what: `phase ${phase}` })

async function activeRental(title) {
  const listing = await createListing('owner', {
    title, type: 'rent', price: FEE, deposit: DEPOSIT, rental_period: 'per week', category: 'sports',
  })
  const r = await rpc('renter', 'request_rental', { p_listing_id: listing.id })
  await rpc('owner', 'respond_rental', { p_rental_id: r.id, p_approve: true })
  await rpc('renter', 'pay_rental', { p_rental_id: r.id, p_method: 'card' })
  await rpc('renter', 'confirm_handover', { p_rental_id: r.id, p_photos: await conditionPhotoAs('renter', r.id) })
  return { listing, id: r.id }
}

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

  // ── Late ─────────────────────────────────────────────────────────────────
  const late = await activeRental('yoga mat (late return)')
  await flow.step('active weekly rental; admin fast-forwards to 3 days past the due date → overdue', async () => {
    // 7-day period + 2.5 days: part days count, so this is 3 days late.
    const toast = await fastForward(admin, late.id, 7 * 24 + 60)
    const r = await phaseIs(late.id, 'overdue')
    return `${toast.replace(/^.*?Escrow jobs/, 'Escrow jobs')} · due ${r.due_date.slice(0, 10)}`
  })

  await flow.step(`renter sees "3 days late · ฿${PER_DAY}/day · late fee so far ฿${3 * PER_DAY}"`, async () => {
    await renter.goto('/rentals?view=renting')
    const c = card(renter, late.id)
    await c.getByText(/3 days late/).waitFor()
    await c.getByText(new RegExp(`฿${PER_DAY}/day`)).waitFor()
    await c.getByText(`฿${3 * PER_DAY}`, { exact: true }).waitFor()
    await shot(renter, 'late-overdue-card')
  })

  await flow.step(`renter returns it with a photo → late fee ฿${3 * PER_DAY} fixed`, async () => {
    await card(renter, late.id).getByRole('button', { name: 'Mark returned' }).click()
    const dialog = renter.getByRole('dialog')
    await dialog.getByText(new RegExp(`฿${3 * PER_DAY} late fee`)).waitFor()
    await addPhotos(renter, dialog, 1)
    await dialog.getByRole('button', { name: 'Mark returned' }).click()
    await expectToast(renter, 'Marked as returned')
    const r = await phaseIs(late.id, 'return-pending')
    if (Number(r.late_days) !== 3 || Number(r.late_fee) !== 3 * PER_DAY) throw new Error(`late ${r.late_days} d, ฿${r.late_fee}`)
    return `late_days ${r.late_days}, late_fee ฿${r.late_fee}`
  })

  const renterBefore = await walletBalance('renter', 'available')
  await flow.step(`owner confirms → owner ฿${3 * PER_DAY} from the deposit, renter ฿${DEPOSIT - 3 * PER_DAY} back`, async () => {
    await owner.goto('/rentals?view=lending')
    await card(owner, late.id).getByRole('button', { name: 'Confirm good return' }).click()
    const dialog = owner.getByRole('dialog')
    await addPhotos(owner, dialog, 1)
    await dialog.getByRole('button', { name: /Confirm & release deposit/ }).click()
    await expectToast(owner, 'Deposit released')
    const r = await phaseIs(late.id, 'released')
    const refunded = (await walletBalance('renter', 'available')) - renterBefore
    if (Number(r.deposit_to_owner) !== 3 * PER_DAY || Number(r.deposit_to_renter) !== DEPOSIT - 3 * PER_DAY || refunded !== DEPOSIT - 3 * PER_DAY) {
      throw new Error(`owner ${r.deposit_to_owner}, renter ${r.deposit_to_renter}, wallet +${refunded}`)
    }
    return `owner ฿${r.deposit_to_owner}, renter ฿${r.deposit_to_renter}`
  })

  // ── Missing ──────────────────────────────────────────────────────────────
  const missing = await activeRental('camping stove (never returned)')
  const ownerBefore = await walletBalance('owner', 'available')
  await flow.step('admin fast-forwards to 9 days past the due date → missing', async () => {
    const toast = await fastForward(admin, missing.id, 7 * 24 + 9 * 24)
    await phaseIs(missing.id, 'missing')
    return toast.replace(/^.*?Escrow jobs/, 'Escrow jobs')
  })

  await flow.step(`full ฿${DEPOSIT} deposit to the owner (capped at the deposit), listing paused`, async () => {
    const r = await rental(missing.id)
    if (Number(r.deposit_to_owner) !== DEPOSIT || Number(r.deposit_to_renter) !== 0) {
      throw new Error(`owner ${r.deposit_to_owner}, renter ${r.deposit_to_renter}`)
    }
    const l = await selectOne('owner', 'listings', missing.listing.id)
    if (l.status !== 'paused') throw new Error(`listing ${l.status}`)
    const gained = (await walletBalance('owner', 'available')) - ownerBefore
    if (gained < DEPOSIT) throw new Error(`owner wallet +${gained}`)
    return `owner +฿${gained} (deposit + rental fee), listing paused`
  })

  await flow.step('both sides see "counted as missing"', async () => {
    await renter.goto('/rentals?view=renting')
    await card(renter, missing.id).getByText(/counted as missing/).waitFor()
    await owner.goto('/rentals?view=lending')
    await card(owner, missing.id).getByText(/counted as missing/).waitFor()
    await shot(owner, 'missing-card')
  })
}

if (isMain(import.meta.url)) {
  const ok = await runFlow('late', main)
  process.exit(ok ? 0 : 1)
}
