import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RENTAL_COMMISSION_RATE,
  ESCROW_HANDLING_FEE,
  PREMIUM_PLACEMENT_FEE,
  computeRentalQuote,
  rentalDueDate,
} from './fees.ts'

test('fee constants match the proposal money angle', () => {
  assert.equal(RENTAL_COMMISSION_RATE, 0.1)
  assert.equal(ESCROW_HANDLING_FEE, 30)
  assert.equal(PREMIUM_PLACEMENT_FEE, 49)
})

test('quote takes 10% commission plus a flat escrow fee from the renter at booking', () => {
  const q = computeRentalQuote({ price: 250, deposit: 800 })
  assert.equal(q.rentalFee, 250)
  assert.equal(q.commission, 25)
  assert.equal(q.handlingFee, 30)
  assert.equal(q.deposit, 800)
  assert.equal(q.platformFees, 55)
  assert.equal(q.totalDueNow, 250 + 25 + 30 + 800)
  assert.equal(q.refundable, 800)
})

test('commission is rounded to whole baht', () => {
  const q = computeRentalQuote({ price: 85, deposit: 200 })
  assert.equal(q.commission, 9)
  assert.equal(q.totalDueNow, 85 + 9 + 30 + 200)
})

test('a missing deposit is treated as zero', () => {
  const q = computeRentalQuote({ price: 100 })
  assert.equal(q.deposit, 0)
  assert.equal(q.refundable, 0)
  assert.equal(q.totalDueNow, 100 + 10 + 30)
})

test('due date follows the rental period', () => {
  const start = new Date('2026-09-23T00:00:00Z')
  const day = 86_400_000
  assert.equal(rentalDueDate(start, 'per week').getTime(), start.getTime() + 7 * day)
  assert.equal(rentalDueDate(start, 'per month').getTime(), start.getTime() + 30 * day)
  assert.equal(rentalDueDate(start, 'per semester').getTime(), start.getTime() + 120 * day)
  assert.equal(rentalDueDate(start, undefined).getTime(), start.getTime() + 120 * day)
})
