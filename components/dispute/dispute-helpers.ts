// Shared labels and rules for the dispute pages and the admin queue.
// Money rules: docs/BusinessRules.md §6. Amounts always come from database
// columns or lib/fees.ts.

import { settleDeposit, type DepositSettlement } from '@/lib/fees'
import type { Dispute, DisputeFinding, Rental, Transaction } from '@/lib/types'

export type DealKind = 'rental' | 'sale'

export const FINDING_LABELS: Record<DisputeFinding, string> = {
  'normal-wear': 'Normal wear',
  'repairable-damage': 'Repairable damage',
  'lost-or-destroyed': 'Lost or destroyed',
  'not-as-described': 'Not as described',
}

/** Sale disputes decided as "normal-wear" mean the claim was rejected (seller paid in full). */
export function findingLabel(finding: DisputeFinding, kind: DealKind): string {
  if (kind === 'sale' && finding === 'normal-wear') return 'As described (claim rejected)'
  return FINDING_LABELS[finding]
}

/** Who is who in a deal, for labels. */
export function partyRoles(kind: DealKind): { claimant: string; counterparty: string } {
  return kind === 'rental' ? { claimant: 'Renter', counterparty: 'Owner' } : { claimant: 'Buyer', counterparty: 'Seller' }
}

/** Reason options shown when filing, by deal kind and the filer's role. */
export function reasonOptions(kind: DealKind, role: 'owner' | 'renter' | 'buyer'): string[] {
  if (kind === 'sale') {
    return ['Not as described', 'Damaged or broken', 'Missing parts or accessories', 'Counterfeit item', 'Other']
  }
  if (role === 'owner') {
    return ['Damage beyond normal wear', 'Item lost or destroyed', 'Missing parts or accessories', 'Late fee', 'Other']
  }
  return ['Damage was already there at handover', 'Late fee is wrong', 'Other']
}

/** Milliseconds left in the dispute window (≤ 0 when closed or not open). */
export function windowLeftMs(endsAt: string | undefined, now: number): number {
  if (!endsAt) return 0
  return new Date(endsAt).getTime() - now
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'closed'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 1) return `${hours} h ${minutes} m`
  return `${minutes} m`
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Why the signed-in user can't file a dispute on this deal right now, or null
 * when they can. Mirrors the checks in file_dispute (the server decides).
 */
export function filingBlocker(
  deal: { kind: 'rental'; rental: Rental } | { kind: 'sale'; transaction: Transaction },
  userId: string,
  now: number,
): string | null {
  if (deal.kind === 'rental') {
    const r = deal.rental
    if (userId !== r.renterId && userId !== r.ownerId) return 'Only the renter or the owner of this rental can open a dispute.'
    if (r.phase === 'disputed') return 'A dispute is already open for this rental.'
    if (r.phase !== 'return-pending') {
      return `A rental dispute can be opened only after the return, within the 48-hour window. This rental is ${r.phase.replace('-', ' ')}.`
    }
    if (windowLeftMs(r.disputeWindowEndsAt, now) <= 0) return 'The 48-hour dispute window for this rental has closed.'
    return null
  }
  const t = deal.transaction
  if (t.mode !== 'protected') return 'Sales paid in person have no escrow, so they have no dispute support.'
  if (userId !== t.buyerId) return 'Only the buyer can open a dispute on a purchase.'
  if (t.status === 'disputed') return 'A dispute is already open for this purchase.'
  if (t.status !== 'handed-over') {
    return `A purchase dispute can be opened only after handover, within the 48-hour window. This purchase is ${t.status.replace('-', ' ')}.`
  }
  if (windowLeftMs(t.disputeWindowEndsAt, now) <= 0) return 'The 48-hour dispute window for this purchase has closed.'
  return null
}

/**
 * Preview of a resolution, the same maths as resolve_dispute:
 *   rental: owner gets min(deposit, lateFee + claim), renter the rest
 *   sale:   buyer gets the refund, seller the rest of the price
 * `toOwner` is the owner's / seller's share, `toRenter` the renter's / buyer's.
 */
export function previewResolution(
  input: { kind: 'rental'; deposit: number; lateFee: number } | { kind: 'sale'; price: number },
  finding: DisputeFinding,
  amount: number,
): DepositSettlement {
  if (input.kind === 'rental') {
    const claim =
      finding === 'lost-or-destroyed' ? input.deposit : finding === 'repairable-damage' ? Math.max(0, amount) : 0
    return settleDeposit(input.deposit, input.lateFee + claim)
  }
  const refund = finding === 'not-as-described' ? Math.min(input.price, Math.max(0, amount)) : 0
  return settleDeposit(input.price, input.price - refund)
}

/** The amounts a resolved dispute settled, from the dispute row. */
export function resolvedSplit(dispute: Dispute): { toOwner: number; toClaimantSide: number } | null {
  if (dispute.status !== 'resolved') return null
  if (dispute.rentalId) {
    return { toOwner: dispute.depositToOwner ?? 0, toClaimantSide: dispute.depositToRenter ?? 0 }
  }
  return { toOwner: dispute.sellerAmount ?? 0, toClaimantSide: dispute.refundToBuyer ?? 0 }
}
