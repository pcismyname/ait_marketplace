import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RENTAL_COMMISSION_RATE,
  SALE_COMMISSION_RATE,
  ESCROW_FEE_MIN,
  ESCROW_FEE_RATE,
  PREMIUM_PLACEMENT_FEE,
  PREMIUM_PLACEMENT_DAYS,
  DEPOSIT_MIN,
  DEPOSIT_MAX,
  DISPUTE_WINDOW_HOURS,
  OWNER_PAYOUT_DELAY_HOURS,
  SUGGESTED_DEPOSIT,
  buyerProtectionFee,
  clampDeposit,
  computeRentalQuote,
  computeSaleQuote,
  dailyLateFee,
  daysLate,
  depositRangeForValue,
  disputeWindowEndsAt,
  escrowHandlingFee,
  lateReturnSettlement,
  needsRentalApproval,
  ownerPayoutAt,
  rentalDueDate,
  returnStatus,
  saleCommission,
  settleDeposit,
  suggestedDeposit,
  validateDeposit,
} from './fees.ts'

const DAY = 86_400_000
const HOUR = 3_600_000

test('fee constants match BusinessRules.md §2', () => {
  assert.equal(RENTAL_COMMISSION_RATE, 0.1)
  assert.equal(SALE_COMMISSION_RATE, 0.1)
  assert.equal(ESCROW_FEE_MIN, 30)
  assert.equal(ESCROW_FEE_RATE, 0.03)
  assert.equal(PREMIUM_PLACEMENT_FEE, 49)
  assert.equal(PREMIUM_PLACEMENT_DAYS, 7)
})

test('escrow fee is max(30, 3% of deposit)', () => {
  assert.equal(escrowHandlingFee(0), 30)
  assert.equal(escrowHandlingFee(800), 30) // 24 → minimum
  assert.equal(escrowHandlingFee(1000), 30)
  assert.equal(escrowHandlingFee(1500), 45)
  assert.equal(escrowHandlingFee(3000), 90)
})

test('rental quote matches the mini fridge example (฿1,105)', () => {
  const q = computeRentalQuote({ price: 250, deposit: 800 })
  assert.equal(q.rentalFee, 250)
  assert.equal(q.commission, 25)
  assert.equal(q.handlingFee, 30)
  assert.equal(q.deposit, 800)
  assert.equal(q.platformFees, 55)
  assert.equal(q.totalDueNow, 1105)
  assert.equal(q.refundable, 800)
})

test('rental quote scales the escrow fee on large deposits', () => {
  const q = computeRentalQuote({ price: 500, deposit: 2000 })
  assert.equal(q.commission, 50)
  assert.equal(q.handlingFee, 60)
  assert.equal(q.totalDueNow, 500 + 50 + 60 + 2000)
})

test('commission is rounded to whole baht', () => {
  const q = computeRentalQuote({ price: 85, deposit: 200 })
  assert.equal(q.commission, 9)
  assert.equal(q.totalDueNow, 85 + 9 + 30 + 200)
})

test('sale paid in person is free and unprotected', () => {
  const q = computeSaleQuote(1200, 'in-person')
  assert.equal(q.protectionFee, 0)
  assert.equal(q.total, 1200)
  assert.equal(q.escrow, false)
  assert.equal(q.sellerCommission, 0)
  assert.equal(q.sellerPayout, 1200)
})

test('sale paid with protection adds 10 + 3% of price', () => {
  assert.equal(buyerProtectionFee(1000), 40)
  assert.equal(buyerProtectionFee(150), 15) // 10 + round(4.5)
  const q = computeSaleQuote(1000, 'protected')
  assert.equal(q.protectionFee, 40)
  assert.equal(q.total, 1040)
  assert.equal(q.escrow, true)
})

test('protected sale takes a 10% commission from the seller payout', () => {
  const q = computeSaleQuote(1000, 'protected')
  assert.equal(q.sellerCommission, 100)
  assert.equal(q.sellerPayout, 900)
  // Worked example in BusinessRules.md §2: ฿400 lamp.
  const lamp = computeSaleQuote(400, 'protected')
  assert.equal(lamp.total, 422)
  assert.equal(lamp.sellerPayout, 360)
  assert.equal(lamp.protectionFee + lamp.sellerCommission, 62)
})

test('sale commission is rounded to whole baht and charged on what the seller keeps', () => {
  assert.equal(saleCommission(85), 9) // round(8.5)
  assert.equal(saleCommission(84), 8)
  assert.equal(saleCommission(1000 - 400), 60) // partial refund of 400
  assert.equal(saleCommission(0), 0) // full refund
  assert.equal(saleCommission(-5), 0)
})

test('deposit suggestions by category match BusinessRules.md §3', () => {
  assert.deepEqual(SUGGESTED_DEPOSIT, {
    kitchen: 300,
    textbooks: 200,
    sports: 300,
    furniture: 500,
    electronics: 800,
    bicycles: 1000,
    other: 300,
  })
  assert.equal(suggestedDeposit(undefined), 300)
})

test('deposits are clamped to ฿200 – ฿3,000', () => {
  assert.equal(DEPOSIT_MIN, 200)
  assert.equal(DEPOSIT_MAX, 3000)
  assert.equal(clampDeposit(50), 200)
  assert.equal(clampDeposit(4000), 3000)
  assert.equal(clampDeposit(750), 750)
})

test('deposit range is 30 – 50% of replacement value, clamped', () => {
  assert.deepEqual(depositRangeForValue(2000), { min: 600, max: 1000 })
  assert.deepEqual(depositRangeForValue(400), { min: 200, max: 200 })
  assert.deepEqual(depositRangeForValue(8000), { min: 2400, max: 3000 })
})

test('validateDeposit rejects empty, zero and out-of-range deposits', () => {
  assert.notEqual(validateDeposit(undefined), null)
  assert.notEqual(validateDeposit(0), null)
  assert.notEqual(validateDeposit(Number.NaN), null)
  assert.notEqual(validateDeposit(199), null)
  assert.notEqual(validateDeposit(3001), null)
  assert.equal(validateDeposit(200), null)
  assert.equal(validateDeposit(3000), null)
  assert.notEqual(validateDeposit(300, 2000), null) // below 30% of 2,000
  assert.equal(validateDeposit(800, 2000), null)
})

test('items above ฿6,000 need rental approval', () => {
  assert.equal(needsRentalApproval(6000), false)
  assert.equal(needsRentalApproval(6001), true)
  assert.equal(needsRentalApproval(undefined), false)
})

test('due date follows the rental period', () => {
  const start = new Date('2026-09-23T00:00:00Z')
  assert.equal(rentalDueDate(start, 'per week').getTime(), start.getTime() + 7 * DAY)
  assert.equal(rentalDueDate(start, 'per month').getTime(), start.getTime() + 30 * DAY)
  assert.equal(rentalDueDate(start, 'per semester').getTime(), start.getTime() + 120 * DAY)
  assert.equal(rentalDueDate(start, undefined).getTime(), start.getTime() + 120 * DAY)
})

test('dispute window and owner payout are 48 hours', () => {
  const t = new Date('2026-10-01T10:00:00Z')
  assert.equal(DISPUTE_WINDOW_HOURS, 48)
  assert.equal(OWNER_PAYOUT_DELAY_HOURS, 48)
  assert.equal(disputeWindowEndsAt(t).getTime(), t.getTime() + 48 * HOUR)
  assert.equal(ownerPayoutAt(t).getTime(), t.getTime() + 48 * HOUR)
})

test('daily late fee is ceil(rentalFee / periodDays)', () => {
  assert.equal(dailyLateFee(250, 'per semester'), 3) // 250 / 120 = 2.08
  assert.equal(dailyLateFee(100, 'per week'), 15) // 100 / 7 = 14.3
  assert.equal(dailyLateFee(300, 'per month'), 10)
})

test('return status: on time, overdue, then missing after 7 days', () => {
  const due = new Date('2026-10-10T00:00:00Z')
  assert.equal(daysLate(due, new Date(due.getTime() - HOUR)), 0)
  assert.equal(returnStatus(due, due), 'on-time')
  assert.equal(daysLate(due, new Date(due.getTime() + HOUR)), 1)
  assert.equal(returnStatus(due, new Date(due.getTime() + 3 * DAY)), 'overdue')
  assert.equal(returnStatus(due, new Date(due.getTime() + 7 * DAY)), 'overdue')
  assert.equal(returnStatus(due, new Date(due.getTime() + 7 * DAY + HOUR)), 'missing')
})

test('owner never receives more than the deposit', () => {
  assert.deepEqual(settleDeposit(800, 0), { toOwner: 0, toRenter: 800 })
  assert.deepEqual(settleDeposit(800, 300), { toOwner: 300, toRenter: 500 })
  assert.deepEqual(settleDeposit(800, 5000), { toOwner: 800, toRenter: 0 })
})

test('late return takes the daily fee from the deposit; missing takes it all', () => {
  const due = new Date('2026-10-10T00:00:00Z')
  const base = { deposit: 800, rentalFee: 300, rentalPeriod: 'per month', dueDate: due }
  const late = lateReturnSettlement({ ...base, returnedAt: new Date(due.getTime() + 3 * DAY) })
  assert.equal(late.status, 'overdue')
  assert.equal(late.daysLate, 3)
  assert.equal(late.toOwner, 30)
  assert.equal(late.toRenter, 770)
  const missing = lateReturnSettlement({ ...base, returnedAt: new Date(due.getTime() + 10 * DAY) })
  assert.equal(missing.status, 'missing')
  assert.equal(missing.toOwner, 800)
  assert.equal(missing.toRenter, 0)
})
