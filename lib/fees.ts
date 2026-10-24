// Money logic for Pass It On. Source of truth: docs/BusinessRules.md.
// If this file and BusinessRules.md disagree, BusinessRules.md wins.
//
// - Listing is always free. Sales paid in person are free and unprotected.
// - Sales paid "with protection" add a buyer protection fee (฿10 + 3%).
// - Rentals add a 10% commission and an escrow fee of max(฿30, 3% of the
//   deposit), both paid by the renter at booking. The deposit is held by the
//   platform (never the owner) and refunded after the return.
// - Premium placement costs ฿49 for 7 days.
// All payments are simulated: no gateway is integrated in the course build.

import type { CategoryId } from './types'

// ─── Fees (BusinessRules.md §2) ──────────────────────────────────────────────

/** Share of the rental fee kept by the platform on every rental booking. */
export const RENTAL_COMMISSION_RATE = 0.1

/** Minimum escrow handling fee (THB) per rental. */
export const ESCROW_FEE_MIN = 30

/** Escrow handling fee as a share of the deposit, when above the minimum. */
export const ESCROW_FEE_RATE = 0.03

/** Flat part (THB) of the buyer protection fee on protected sales. */
export const BUYER_PROTECTION_BASE_FEE = 10

/** Share of the sale price added to the buyer protection fee. */
export const BUYER_PROTECTION_RATE = 0.03

/** Flat fee (THB) for premium placement in search and matching. */
export const PREMIUM_PLACEMENT_FEE = 49

/** How long premium placement lasts, in days. */
export const PREMIUM_PLACEMENT_DAYS = 7

/** Escrow handling fee for a rental: `max(30, round(deposit * 3%))`. */
export function escrowHandlingFee(deposit: number): number {
  return Math.max(ESCROW_FEE_MIN, Math.round(deposit * ESCROW_FEE_RATE))
}

/** Buyer protection fee for a protected sale: `10 + round(price * 3%)`. */
export function buyerProtectionFee(price: number): number {
  return BUYER_PROTECTION_BASE_FEE + Math.round(price * BUYER_PROTECTION_RATE)
}

// ─── Rental quote ────────────────────────────────────────────────────────────

export interface RentalQuoteInput {
  /** Rental price for one rental period, in THB. */
  price: number
  /** Refundable deposit, in THB. Treated as zero when missing (legacy data). */
  deposit?: number
}

export interface RentalQuote {
  rentalFee: number
  commission: number
  /** Escrow handling fee: `max(30, 3% of deposit)`. */
  handlingFee: number
  deposit: number
  /** Commission plus handling fee: what the platform keeps. */
  platformFees: number
  /** Everything the renter pays at booking, including the deposit. */
  totalDueNow: number
  /** Amount returned to the renter after a confirmed return. */
  refundable: number
}

export function computeRentalQuote(input: RentalQuoteInput): RentalQuote {
  const rentalFee = input.price
  const deposit = input.deposit ?? 0
  const commission = Math.round(rentalFee * RENTAL_COMMISSION_RATE)
  const handlingFee = escrowHandlingFee(deposit)
  const platformFees = commission + handlingFee
  return {
    rentalFee,
    commission,
    handlingFee,
    deposit,
    platformFees,
    totalDueNow: rentalFee + platformFees + deposit,
    refundable: deposit,
  }
}

// ─── Sale quote (BusinessRules.md §2, §5) ────────────────────────────────────

/** How a sale is paid: directly to the seller, or held by the platform. */
export type SalePaymentMode = 'in-person' | 'protected'

export interface SaleQuote {
  mode: SalePaymentMode
  price: number
  /** Zero for in-person sales. */
  protectionFee: number
  total: number
  /** Protected sales are held in escrow and get the dispute window. */
  escrow: boolean
}

export function computeSaleQuote(price: number, mode: SalePaymentMode): SaleQuote {
  const protectionFee = mode === 'protected' ? buyerProtectionFee(price) : 0
  return {
    mode,
    price,
    protectionFee,
    total: price + protectionFee,
    escrow: mode === 'protected',
  }
}

// ─── Deposits (BusinessRules.md §3) ──────────────────────────────────────────

/** Smallest deposit a rental listing can have (THB). */
export const DEPOSIT_MIN = 200

/** Largest deposit a rental listing can have (THB). */
export const DEPOSIT_MAX = 3000

/** Deposit range as a share of the item's replacement value. */
export const DEPOSIT_VALUE_MIN_RATE = 0.3
export const DEPOSIT_VALUE_MAX_RATE = 0.5

/** Items worth more than this need admin approval to be rented. (open) */
export const HIGH_VALUE_RENTAL_THRESHOLD = 6000

/** Suggested starting deposit per category (THB). */
export const SUGGESTED_DEPOSIT: Record<CategoryId, number> = {
  kitchen: 300,
  textbooks: 200,
  sports: 300,
  furniture: 500,
  electronics: 800,
  bicycles: 1000,
  other: 300,
}

export function suggestedDeposit(category: CategoryId | undefined): number {
  return category ? SUGGESTED_DEPOSIT[category] : SUGGESTED_DEPOSIT.other
}

/** Clamp an amount to the ฿200 – ฿3,000 deposit limits. */
export function clampDeposit(amount: number): number {
  return Math.min(DEPOSIT_MAX, Math.max(DEPOSIT_MIN, Math.round(amount)))
}

/**
 * Allowed deposit range for an item with a known replacement value:
 * 30 – 50% of the value, each end clamped to ฿200 – ฿3,000.
 */
export function depositRangeForValue(replacementValue: number): { min: number; max: number } {
  return {
    min: clampDeposit(replacementValue * DEPOSIT_VALUE_MIN_RATE),
    max: clampDeposit(replacementValue * DEPOSIT_VALUE_MAX_RATE),
  }
}

/** True when renting the item needs admin approval (value above ~฿6,000). */
export function needsRentalApproval(replacementValue: number | undefined): boolean {
  return (replacementValue ?? 0) > HIGH_VALUE_RENTAL_THRESHOLD
}

/**
 * Validate a rental deposit. Returns an error message, or null when valid.
 * Pass `replacementValue` when known to also enforce the 30 – 50% range.
 */
export function validateDeposit(deposit: number | undefined, replacementValue?: number): string | null {
  if (deposit === undefined || !Number.isFinite(deposit) || deposit <= 0) {
    return `A rental needs a deposit of at least ฿${DEPOSIT_MIN}.`
  }
  if (deposit < DEPOSIT_MIN) return `The deposit must be at least ฿${DEPOSIT_MIN}.`
  if (deposit > DEPOSIT_MAX) return `The deposit can be at most ฿${DEPOSIT_MAX.toLocaleString('en-US')}.`
  if (replacementValue !== undefined && replacementValue > 0) {
    const { min, max } = depositRangeForValue(replacementValue)
    if (deposit < min || deposit > max) {
      return `For an item worth ฿${replacementValue.toLocaleString('en-US')}, the deposit must be between ฿${min.toLocaleString('en-US')} and ฿${max.toLocaleString('en-US')}.`
    }
  }
  return null
}

// ─── Rental periods, payouts, late returns (BusinessRules.md §4, §6) ────────

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const PERIOD_DAYS: Record<string, number> = {
  'per week': 7,
  'per month': 30,
  'per semester': 120,
}

/** Length of one rental period in days (unknown periods count as a semester). */
export function rentalPeriodDays(rentalPeriod: string | undefined): number {
  return PERIOD_DAYS[rentalPeriod ?? ''] ?? PERIOD_DAYS['per semester']
}

/** Due date for a rental that starts on `start` and runs one rental period. */
export function rentalDueDate(start: Date, rentalPeriod: string | undefined): Date {
  return new Date(start.getTime() + rentalPeriodDays(rentalPeriod) * DAY_MS)
}

/** Dispute window length: starts at handover (sales) or return (rentals). */
export const DISPUTE_WINDOW_HOURS = 48

/** The owner's rental fee is paid out this long after handover, if no dispute. */
export const OWNER_PAYOUT_DELAY_HOURS = 48

/** A rental this many days late (or more than this) counts as missing. */
export const MISSING_AFTER_DAYS = 7

/** When the dispute window that opened at `start` closes. */
export function disputeWindowEndsAt(start: Date): Date {
  return new Date(start.getTime() + DISPUTE_WINDOW_HOURS * HOUR_MS)
}

/** When the owner's rental fee is released, for a handover at `handover`. */
export function ownerPayoutAt(handover: Date): Date {
  return new Date(handover.getTime() + OWNER_PAYOUT_DELAY_HOURS * HOUR_MS)
}

/** Daily late fee taken from the deposit: `ceil(rentalFee / periodDays)`. */
export function dailyLateFee(rentalFee: number, rentalPeriod: string | undefined): number {
  return Math.ceil(rentalFee / rentalPeriodDays(rentalPeriod))
}

/** Whole days past the due date (0 when not late). Part days count as a day. */
export function daysLate(dueDate: Date, now: Date): number {
  const late = now.getTime() - dueDate.getTime()
  return late > 0 ? Math.ceil(late / DAY_MS) : 0
}

export type ReturnStatus = 'on-time' | 'overdue' | 'missing'

/** On time, overdue (1 – 7 days late) or missing (more than 7 days late). */
export function returnStatus(dueDate: Date, now: Date): ReturnStatus {
  const days = daysLate(dueDate, now)
  if (days === 0) return 'on-time'
  return days > MISSING_AFTER_DAYS ? 'missing' : 'overdue'
}

export interface DepositSettlement {
  toOwner: number
  toRenter: number
}

/**
 * Split a deposit between owner and renter. The owner can never receive
 * more than the deposit (BusinessRules.md §6).
 */
export function settleDeposit(deposit: number, ownerClaim: number): DepositSettlement {
  const toOwner = Math.min(deposit, Math.max(0, Math.round(ownerClaim)))
  return { toOwner, toRenter: deposit - toOwner }
}

/**
 * Late-return settlement: missing items send the full deposit to the owner;
 * otherwise the daily late fee per day late, capped at the deposit.
 */
export function lateReturnSettlement(input: {
  deposit: number
  rentalFee: number
  rentalPeriod: string | undefined
  dueDate: Date
  returnedAt: Date
}): DepositSettlement & { daysLate: number; status: ReturnStatus } {
  const days = daysLate(input.dueDate, input.returnedAt)
  const status = returnStatus(input.dueDate, input.returnedAt)
  const claim = status === 'missing'
    ? input.deposit
    : days * dailyLateFee(input.rentalFee, input.rentalPeriod)
  return { ...settleDeposit(input.deposit, claim), daysLate: days, status }
}
