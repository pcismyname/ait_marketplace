// Admin tools. Admins are users with users.is_admin = true (set with SQL or
// scripts/seed-demo.mjs; never from the app). The RPCs check is_admin().

import type { Dispute, DisputeFinding, Listing, Message, Rental, Transaction, User } from '../types'
import { check, db, unwrap, unwrapMaybe } from './client'
import { LISTING_COLUMNS, mapDispute, mapListing, mapRental, mapTransaction, mapUser } from './mappers'

export async function isCurrentUserAdmin(): Promise<boolean> {
  return Boolean(unwrap(await db().rpc('is_admin')))
}

/** Dispute queue, oldest open first. */
export async function listDisputes(status: 'open' | 'resolved' | 'all' = 'open'): Promise<Dispute[]> {
  let query = db().from('disputes').select('*')
  if (status !== 'all') query = query.eq('status', status)
  const rows = unwrap(await query.order('created_at', { ascending: status === 'open' }))
  return rows.map(mapDispute)
}

export interface DisputeContext {
  dispute: Dispute
  rental?: Rental
  transaction?: Transaction
  listing?: Listing
  parties: User[]
  /** Chat between the two parties about this listing (admins can read it). */
  messages: Message[]
  /** Storage paths: handover + return photos and the dispute evidence. */
  photos: { handover: string[]; returned: string[]; evidence: string[] }
}

/** Everything an admin needs to decide a dispute (BusinessRules §6). */
export async function getDisputeContext(disputeId: string): Promise<DisputeContext | null> {
  const client = db()
  const row = unwrapMaybe(await client.from('disputes').select('*').eq('id', disputeId).maybeSingle())
  if (!row) return null
  const dispute = mapDispute(row)

  const rentalRow = dispute.rentalId
    ? unwrapMaybe(await client.from('rentals').select('*').eq('id', dispute.rentalId).maybeSingle())
    : null
  const txRow = dispute.transactionId
    ? unwrapMaybe(await client.from('transactions').select('*').eq('id', dispute.transactionId).maybeSingle())
    : null
  const rental = rentalRow ? mapRental(rentalRow) : undefined
  const transaction = txRow ? mapTransaction(txRow) : undefined
  const listingId = rental?.listingId ?? transaction?.listingId

  const listingRow = listingId
    ? unwrapMaybe(await client.from('listings').select(LISTING_COLUMNS).eq('id', listingId).maybeSingle())
    : null
  const partyIds = [dispute.filedBy, dispute.againstId]
  const users = unwrap(await client.from('users').select('*').in('id', partyIds)).map(mapUser)

  // Threads on this listing that include both parties.
  let messages: Message[] = []
  if (listingId) {
    const threads = unwrap(await client.from('threads').select('id').eq('listing_id', listingId))
    const threadIds = threads.map((t) => t.id)
    if (threadIds.length > 0) {
      const participants = unwrap(
        await client.from('thread_participants').select('thread_id, user_id').in('thread_id', threadIds),
      )
      const shared = threadIds.filter((id) =>
        partyIds.every((p) => participants.some((tp) => tp.thread_id === id && tp.user_id === p)),
      )
      if (shared.length > 0) {
        const rows = unwrap(
          await client.from('messages').select('*').in('thread_id', shared).order('created_at', { ascending: true }),
        )
        messages = rows.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          text: m.text,
          createdAt: m.created_at ?? '',
        }))
      }
    }
  }

  return {
    dispute,
    rental,
    transaction,
    listing: listingRow ? mapListing(listingRow) : undefined,
    parties: users,
    messages,
    photos: {
      handover: rental?.handoverPhotos ?? transaction?.handoverPhotos ?? [],
      returned: rental?.returnPhotos ?? [],
      evidence: dispute.evidence,
    },
  }
}

/**
 * Decide a dispute (BusinessRules §6).
 *   rental:  'normal-wear' (฿0 to owner) · 'repairable-damage' + amount = repair cost
 *            · 'lost-or-destroyed' (full deposit). Any late fee is added; the owner
 *            never gets more than the deposit.
 *   sale:    'not-as-described' + amount = refund (default: full price)
 *            · 'normal-wear' (claim rejected, no refund; seller paid the price
 *            minus the sale commission). The returned row has the net seller_amount.
 */
export async function resolveDispute(
  disputeId: string,
  finding: DisputeFinding,
  amount?: number,
  note?: string,
): Promise<Dispute> {
  return mapDispute(
    unwrap(
      await db().rpc('resolve_dispute', {
        p_dispute_id: disputeId,
        p_finding: finding,
        p_amount: amount,
        p_note: note,
      }),
    ),
  )
}

/**
 * Demo helper: move a rental or purchase back in time by `hours` so payouts,
 * windows and late fees can be shown without waiting. Admin only. Follow it
 * with runEscrowJobs().
 */
export async function timeTravel(dealId: string, hours: number): Promise<'rental' | 'sale'> {
  return unwrap(await db().rpc('admin_time_travel', { p_id: dealId, p_hours: hours })) as 'rental' | 'sale'
}

/** Admin moderation: change any listing's status (blocked while a deal is in progress). */
export async function setListingStatus(listingId: string, status: Listing['status']): Promise<void> {
  check(await db().from('listings').update({ status }).eq('id', listingId))
}
