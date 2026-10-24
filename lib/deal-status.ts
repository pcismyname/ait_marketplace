// Labels, roles and timelines for deals (a rental or a sale), shared by the
// transaction status page, orders and notifications. Pure functions only.
//
// States and who may do what come from docs/BusinessRules.md §4–§6 and the
// state machines in docs/Database.md §3. Every amount shown is read from the
// stored columns (rentals.*, transactions.*), never recomputed here.

import type { Deal } from './api/deals'
import type { RentalPhase, SaleStatus } from './types'

export type DealRole = 'renter' | 'owner' | 'buyer' | 'seller' | 'viewer'

export const dealId = (deal: Deal) => (deal.kind === 'rental' ? deal.rental.id : deal.transaction.id)

export const dealListingId = (deal: Deal) =>
  deal.kind === 'rental' ? deal.rental.listingId : deal.transaction.listingId

/** The viewer's side of the deal ('viewer' for admins and anyone else). */
export function dealRole(deal: Deal, userId: string | null | undefined): DealRole {
  if (!userId) return 'viewer'
  if (deal.kind === 'rental') {
    if (deal.rental.renterId === userId) return 'renter'
    if (deal.rental.ownerId === userId) return 'owner'
    return 'viewer'
  }
  if (deal.transaction.buyerId === userId) return 'buyer'
  if (deal.transaction.sellerId === userId) return 'seller'
  return 'viewer'
}

/** The other party's user id, from the viewer's side (the owner/seller for a viewer). */
export function otherPartyId(deal: Deal, role: DealRole): string | undefined {
  if (deal.kind === 'rental') return role === 'owner' ? deal.rental.renterId : deal.rental.ownerId
  return role === 'seller' ? deal.transaction.buyerId : deal.transaction.sellerId
}

export const OTHER_ROLE_LABEL: Record<DealRole, string> = {
  renter: 'Owner',
  owner: 'Renter',
  buyer: 'Seller',
  seller: 'Buyer',
  viewer: 'Owner / seller',
}

export const RENTAL_PHASE_LABEL: Record<RentalPhase, string> = {
  requested: 'Requested',
  approved: 'Approved · awaiting payment',
  declined: 'Declined',
  cancelled: 'Cancelled',
  paid: 'Paid · awaiting handover',
  active: 'Active',
  overdue: 'Overdue',
  'return-pending': 'Returned · 48 h window',
  disputed: 'Dispute open',
  released: 'Deposit released',
  resolved: 'Dispute resolved',
  missing: 'Missing',
}

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  pending: 'Pay in person · pending',
  paid: 'Paid · held in escrow',
  'handed-over': 'Handed over · 48 h window',
  disputed: 'Dispute open',
  released: 'Released to seller',
  resolved: 'Dispute resolved',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export type DealTone = 'progress' | 'attention' | 'danger' | 'done' | 'muted'

const RENTAL_TONE: Record<RentalPhase, DealTone> = {
  requested: 'progress',
  approved: 'attention',
  declined: 'muted',
  cancelled: 'muted',
  paid: 'progress',
  active: 'progress',
  overdue: 'attention',
  'return-pending': 'attention',
  disputed: 'danger',
  released: 'done',
  resolved: 'done',
  missing: 'danger',
}

const SALE_TONE: Record<SaleStatus, DealTone> = {
  pending: 'progress',
  paid: 'progress',
  'handed-over': 'attention',
  disputed: 'danger',
  released: 'done',
  resolved: 'done',
  completed: 'done',
  cancelled: 'muted',
}

/** Tailwind classes for a status chip, by tone (design tokens only, plus the amber used elsewhere for waits). */
export const TONE_CLASS: Record<DealTone, string> = {
  progress: 'bg-primary-muted text-primary',
  attention: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
  done: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
}

export function dealStatus(deal: Deal): { label: string; tone: DealTone } {
  if (deal.kind === 'rental') {
    return { label: RENTAL_PHASE_LABEL[deal.rental.phase], tone: RENTAL_TONE[deal.rental.phase] }
  }
  return { label: SALE_STATUS_LABEL[deal.transaction.status], tone: SALE_TONE[deal.transaction.status] }
}

/** Deals that can be reviewed by a party (same states submit_review accepts). */
export function isDealClosed(deal: Deal): boolean {
  if (deal.kind === 'rental') return ['released', 'resolved', 'missing'].includes(deal.rental.phase)
  return ['released', 'resolved', 'completed'].includes(deal.transaction.status) && Boolean(deal.transaction.buyerId)
}

/**
 * Where "File a dispute" goes (the filing form, app/dispute/new). An existing
 * dispute is opened by its own id at /dispute/<id> (notifications link there).
 */
export const fileDisputeHref = (deal: Deal) =>
  deal.kind === 'rental' ? `/dispute/new?rental=${deal.rental.id}` : `/dispute/new?transaction=${deal.transaction.id}`
export const disputeHref = (disputeId: string) => `/dispute/${disputeId}`

/** Can this viewer still file a dispute (BusinessRules §6: within 48 h)? */
export function canFileDispute(deal: Deal, role: DealRole, now: number): boolean {
  const ends = deal.kind === 'rental' ? deal.rental.disputeWindowEndsAt : deal.transaction.disputeWindowEndsAt
  if (!ends || new Date(ends).getTime() <= now) return false
  if (deal.kind === 'rental') return deal.rental.phase === 'return-pending' && (role === 'owner' || role === 'renter')
  return deal.transaction.mode === 'protected' && deal.transaction.status === 'handed-over' && role === 'buyer'
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export type StepState = 'done' | 'current' | 'upcoming' | 'stopped'

export interface TimelineStep {
  key: string
  title: string
  detail?: string
  /** When it happened (done) or is due (upcoming / current). */
  at?: string
  /** 'due' when `at` is a deadline rather than a past event. */
  atKind?: 'happened' | 'due'
  state: StepState
}

const step = (s: TimelineStep): TimelineStep => s

/** Rental timeline (BusinessRules §4): request → approve → pay → handover → payout → return → window → settled. */
export function rentalTimeline(deal: Extract<Deal, { kind: 'rental' }>): TimelineStep[] {
  const r = deal.rental
  const steps: TimelineStep[] = [
    step({ key: 'requested', title: 'Booking requested', at: r.requestedAt, atKind: 'happened', state: 'done' }),
  ]
  if (r.phase === 'declined') {
    steps.push(step({
      key: 'declined', title: 'Declined by the owner', detail: r.declineReason, at: r.declinedAt,
      atKind: 'happened', state: 'stopped',
    }))
    return steps
  }
  if (r.phase === 'cancelled') {
    if (r.approvedAt) steps.push(step({ key: 'approved', title: 'Approved by the owner', at: r.approvedAt, atKind: 'happened', state: 'done' }))
    steps.push(step({
      key: 'cancelled', title: 'Cancelled before payment', detail: 'No money moved.', at: r.cancelledAt,
      atKind: 'happened', state: 'stopped',
    }))
    return steps
  }

  steps.push(step({
    key: 'approved', title: 'Approved by the owner', at: r.approvedAt, atKind: 'happened',
    state: r.approvedAt ? 'done' : 'current',
    detail: r.approvedAt ? undefined : 'Waiting for the owner to approve or decline.',
  }))
  steps.push(step({
    key: 'paid', title: 'Paid · deposit held by Pass It On', at: r.paidAt, atKind: 'happened',
    state: r.paidAt ? 'done' : r.approvedAt ? 'current' : 'upcoming',
    detail: r.paidAt ? 'The owner never holds the deposit.' : 'The renter pays the fee, platform fees and the deposit.',
  }))
  steps.push(step({
    key: 'handover', title: 'Handed over · rental starts', at: r.handoverAt, atKind: 'happened',
    state: r.handoverAt ? 'done' : r.paidAt ? 'current' : 'upcoming',
    detail: r.handoverAt ? `Due back ${formatDateTime(r.dueDate)}.` : 'Meet at the pickup point; either side confirms.',
  }))
  steps.push(step({
    key: 'payout', title: 'Rental fee paid to the owner',
    at: r.payoutReleasedAt ?? r.payoutAt,
    atKind: r.payoutReleasedAt ? 'happened' : 'due',
    state: r.payoutReleasedAt ? 'done' : r.handoverAt ? 'current' : 'upcoming',
    detail: r.payoutReleasedAt
      ? undefined
      : r.phase === 'disputed'
        ? 'On hold until the dispute is resolved.'
        : '48 hours after handover, if no dispute is open.',
  }))

  const returned = Boolean(r.returnedAt)
  if (r.phase === 'missing') {
    steps.push(step({
      key: 'return', title: 'Not returned · counted as missing',
      detail: 'More than 7 days late: the full deposit goes to the owner.', at: r.releasedAt,
      atKind: 'happened', state: 'stopped',
    }))
    return steps
  }
  steps.push(step({
    key: 'return',
    title: r.phase === 'overdue' ? 'Return overdue' : 'Returned',
    at: r.returnedAt ?? r.dueDate,
    atKind: returned ? 'happened' : 'due',
    state: returned ? 'done' : r.handoverAt ? 'current' : 'upcoming',
    detail: returned
      ? r.lateDays > 0
        ? `${r.lateDays} ${r.lateDays === 1 ? 'day' : 'days'} late.`
        : 'On time.'
      : r.phase === 'overdue'
        ? 'A daily late fee is taken from the deposit; more than 7 days late counts as missing.'
        : 'The owner checks the condition against the handover photos.',
  }))
  steps.push(step({
    key: 'window',
    title: r.phase === 'disputed' || r.phase === 'resolved' ? 'Dispute filed' : '48-hour dispute window',
    at: r.disputeWindowEndsAt,
    atKind: r.phase === 'return-pending' ? 'due' : 'happened',
    state: r.phase === 'return-pending' || r.phase === 'disputed' ? 'current' : r.releasedAt ? 'done' : 'upcoming',
    detail:
      r.phase === 'disputed'
        ? 'An admin reviews the chat and photos. The deposit stays held.'
        : r.phase === 'return-pending'
          ? 'The deposit is released when the owner confirms, or automatically when the window closes.'
          : undefined,
  }))
  steps.push(step({
    key: 'settled',
    title: r.phase === 'resolved' ? 'Dispute resolved · deposit settled' : 'Deposit released',
    at: r.releasedAt,
    atKind: 'happened',
    state: r.releasedAt ? 'done' : 'upcoming',
  }))
  return steps
}

/** Sale timeline (BusinessRules §5). In person has no escrow and no window. */
export function saleTimeline(deal: Extract<Deal, { kind: 'sale' }>): TimelineStep[] {
  const t = deal.transaction
  if (t.mode === 'in-person') {
    return [
      step({
        key: 'started', title: 'Buyer chose to pay in person', at: t.createdAt, atKind: 'happened', state: 'done',
        detail: 'Paid directly to the seller at pickup: no escrow, no dispute support.',
      }),
      t.status === 'cancelled'
        ? step({ key: 'cancelled', title: 'Cancelled', at: t.cancelledAt, atKind: 'happened', state: 'stopped' })
        : step({
            key: 'completed', title: 'Seller marked it sold', at: t.completedAt, atKind: 'happened',
            state: t.status === 'completed' ? 'done' : 'current',
            detail: t.status === 'completed' ? undefined : 'After the buyer pays at pickup, the seller marks it sold.',
          }),
    ]
  }
  const disputed = t.status === 'disputed' || t.status === 'resolved'
  return [
    step({
      key: 'paid', title: 'Paid · held by Pass It On', at: t.paidAt ?? t.createdAt, atKind: 'happened', state: 'done',
      detail: 'The seller is paid only after the handover window.',
    }),
    step({
      key: 'handover', title: 'Handed over · window opens', at: t.handoverAt, atKind: 'happened',
      state: t.handoverAt ? 'done' : t.status === 'paid' ? 'current' : t.releasedAt ? 'done' : 'upcoming',
      detail: t.handoverAt || t.releasedAt ? undefined : 'Meet at the pickup point; either side confirms.',
    }),
    step({
      key: 'window', title: disputed ? 'Dispute filed' : '48-hour dispute window',
      at: t.disputeWindowEndsAt, atKind: t.status === 'handed-over' ? 'due' : 'happened',
      state: t.status === 'handed-over' || t.status === 'disputed' ? 'current' : t.releasedAt ? 'done' : 'upcoming',
      detail:
        t.status === 'disputed'
          ? 'An admin reviews the chat and photos. The money stays held.'
          : t.status === 'handed-over'
            ? 'Released to the seller when the buyer confirms, or automatically when the window closes.'
            : undefined,
    }),
    step({
      key: 'released', title: t.status === 'resolved' ? 'Dispute resolved' : 'Released to the seller',
      at: t.releasedAt, atKind: 'happened', state: t.releasedAt ? 'done' : 'upcoming',
    }),
  ]
}

export const dealTimeline = (deal: Deal) => (deal.kind === 'rental' ? rentalTimeline(deal) : saleTimeline(deal))

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "2d 4h 05m" (or "4m 09s" under an hour) until `ms` milliseconds. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d}d ${h}h ${pad(m)}m`
  if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`
  return `${m}m ${pad(sec)}s`
}
