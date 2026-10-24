// Disputes (BusinessRules §6). Filed within 48 h: rentals after the return
// (either party), protected sales after handover (buyer). Admins resolve them
// (lib/api/admin.ts). Evidence files are uploaded first with
// uploadEvidence() in lib/api/storage.ts, then their paths are passed here.

import type { Dispute, DisputeComment } from '../types'
import { db, subscribeToTable, unwrap, unwrapMaybe } from './client'
import { mapDispute, mapDisputeComment, type DisputeCommentRow } from './mappers'

export interface FileDisputeInput {
  /** Exactly one of rentalId / transactionId. */
  rentalId?: string
  transactionId?: string
  /** Short label, e.g. "Damage", "Not as described", "Late fee". */
  reason: string
  description?: string
  /** dispute-evidence paths from uploadEvidence(). */
  evidence?: string[]
  /** Optional amount the filer asks for (capped at the deposit / price). */
  claimAmount?: number
}

export async function fileDispute(input: FileDisputeInput): Promise<Dispute> {
  return mapDispute(
    unwrap(
      await db().rpc('file_dispute', {
        p_reason: input.reason,
        p_description: input.description ?? '',
        p_rental_id: input.rentalId,
        p_transaction_id: input.transactionId,
        p_evidence: input.evidence ?? [],
        p_claim_amount: input.claimAmount,
      }),
    ),
  )
}

export async function getDispute(disputeId: string): Promise<Dispute | null> {
  const row = unwrapMaybe(await db().from('disputes').select('*').eq('id', disputeId).maybeSingle())
  return row ? mapDispute(row) : null
}

/** Disputes the signed-in user is party to (admins: all). */
export async function listMyDisputes(): Promise<Dispute[]> {
  const rows = unwrap(await db().from('disputes').select('*').order('created_at', { ascending: false }))
  return rows.map(mapDispute)
}

/** The dispute (if any) about a rental or a purchase, newest first. */
export async function getDisputeFor(target: { rentalId?: string; transactionId?: string }): Promise<Dispute | null> {
  let query = db().from('disputes').select('*')
  if (target.rentalId) query = query.eq('rental_id', target.rentalId)
  else if (target.transactionId) query = query.eq('transaction_id', target.transactionId)
  else return null
  const rows = unwrap(await query.order('created_at', { ascending: false }).limit(1))
  return rows[0] ? mapDispute(rows[0]) : null
}

export async function listDisputeComments(disputeId: string): Promise<DisputeComment[]> {
  const rows = unwrap(
    await db().from('dispute_comments').select('*').eq('dispute_id', disputeId).order('created_at', { ascending: true }),
  )
  return rows.map(mapDisputeComment)
}

/** Parties and admins can comment while the dispute is open. */
export async function addDisputeComment(
  disputeId: string,
  body: string,
  attachments: string[] = [],
): Promise<DisputeComment> {
  return mapDisputeComment(
    unwrap(
      await db()
        .from('dispute_comments')
        .insert({ dispute_id: disputeId, body, attachments })
        .select('*')
        .single(),
    ),
  )
}

export function subscribeToDisputeComments(
  disputeId: string,
  onComment: (comment: DisputeComment) => void,
): () => void {
  return subscribeToTable<DisputeCommentRow>(
    'dispute_comments',
    (row, event) => {
      if (event === 'INSERT') onComment(mapDisputeComment(row))
    },
    `dispute_id=eq.${disputeId}`,
  )
}
