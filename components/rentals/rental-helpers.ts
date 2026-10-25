// Shared, pure helpers for the rental booking lifecycle UI (BusinessRules §4).
// Every amount comes from the rental's database columns or lib/fees.ts; every
// deadline comes from a timestamp column (due_date, payout_at,
// dispute_window_ends_at), never from a guess.

import { computeRentalQuote, lateReturnSettlement, MISSING_AFTER_DAYS, type RentalQuote } from '@/lib/fees'
import type { Rental, RentalPhase } from '@/lib/types'

const DAY_MS = 86_400_000

export type RentalRole = 'renter' | 'owner'

export interface PhaseMeta {
  label: string
  /** Tailwind text colour token for the badge. */
  tone: 'muted' | 'primary' | 'warning' | 'destructive'
}

export const PHASE_META: Record<RentalPhase, PhaseMeta> = {
  requested: { label: 'Requested', tone: 'muted' },
  approved: { label: 'Approved · awaiting payment', tone: 'primary' },
  declined: { label: 'Declined', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  paid: { label: 'Paid · deposit held', tone: 'primary' },
  active: { label: 'Active', tone: 'primary' },
  overdue: { label: 'Overdue', tone: 'warning' },
  missing: { label: 'Missing', tone: 'destructive' },
  'return-pending': { label: 'Returned · 48 h check', tone: 'warning' },
  released: { label: 'Deposit released', tone: 'primary' },
  disputed: { label: 'Dispute open', tone: 'destructive' },
  resolved: { label: 'Dispute resolved', tone: 'muted' },
}

export const TONE_CLASS: Record<PhaseMeta['tone'], string> = {
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  warning: 'text-surge-foreground',
  destructive: 'text-destructive',
}

/** Booking still in progress (one per renter per item at most, by the RPCs). */
export const OPEN_PHASES: ReadonlySet<RentalPhase> = new Set<RentalPhase>([
  'requested',
  'approved',
  'paid',
  'active',
  'overdue',
  'return-pending',
  'disputed',
])

/** The platform still holds the renter's deposit (BusinessRules §7). */
export const DEPOSIT_HELD_PHASES: ReadonlySet<RentalPhase> = new Set<RentalPhase>([
  'paid',
  'active',
  'overdue',
  'return-pending',
  'disputed',
])

export const CLOSED_PHASES: ReadonlySet<RentalPhase> = new Set<RentalPhase>([
  'released',
  'resolved',
  'missing',
  'declined',
  'cancelled',
])

/**
 * The amount pay_rental charges: the server recomputes quote_rental(rental_fee,
 * deposit) from the rental's columns, which computeRentalQuote mirrors exactly
 * (parity-tested). Once paid, total_paid is the source of truth.
 */
export function rentalQuote(rental: Rental): RentalQuote {
  return computeRentalQuote({ price: rental.rentalFee, deposit: rental.deposit })
}

/** Late fee accrued so far for an overdue rental, from due_date and lib/fees.ts. */
export function lateSoFar(rental: Rental, now: Date) {
  return lateReturnSettlement({
    deposit: rental.deposit,
    rentalFee: rental.rentalFee,
    rentalPeriod: rental.rentalPeriod,
    dueDate: new Date(rental.dueDate),
    returnedAt: now,
  })
}

/** Moment after which an unreturned rental counts as missing (> 7 days late). */
export function missingAfter(rental: Rental): Date {
  return new Date(new Date(rental.dueDate).getTime() + MISSING_AFTER_DAYS * DAY_MS)
}

/** "2d 4h", "3h 12m", "8m" until `target`; null once it has passed. */
export function timeLeft(target: string | Date | undefined, now: Date): string | null {
  if (!target) return null
  const ms = new Date(target).getTime() - now.getTime()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${Math.max(1, mins)}m`
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDay(iso: string | Date | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function roleOf(rental: Rental, userId: string | null): RentalRole | null {
  if (!userId) return null
  if (rental.renterId === userId) return 'renter'
  if (rental.ownerId === userId) return 'owner'
  return null
}

/**
 * Where to file a dispute about a rental. The disputes page reads the rental
 * id from the query string; it checks the 48 h window again on the server.
 */
export function newDisputeHref(rentalId: string): string {
  return `/dispute/new?rental=${encodeURIComponent(rentalId)}`
}

export function disputeHref(disputeId: string): string {
  return `/dispute/${encodeURIComponent(disputeId)}`
}

/** True when this user already uploaded photos for the rental (paths are rental/<id>/<uid>/…). */
export function hasPhotosFrom(paths: string[], userId: string | null): boolean {
  if (!userId) return false
  return paths.some((p) => p.split('/')[2] === userId)
}

/** Next moment something changes on the server for these rentals (for a timed refresh). */
export function nextDeadline(rentals: Rental[], now: Date): number | null {
  let next: number | null = null
  const consider = (iso: string | undefined) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (t > now.getTime() && (next === null || t < next)) next = t
  }
  for (const r of rentals) {
    if (['active', 'paid', 'overdue', 'return-pending', 'disputed'].includes(r.phase) && !r.payoutReleasedAt) {
      consider(r.payoutAt)
    }
    if (r.phase === 'active') consider(r.dueDate)
    if (r.phase === 'overdue') consider(missingAfter(r).toISOString())
    if (r.phase === 'return-pending') consider(r.disputeWindowEndsAt)
  }
  return next
}
