// Reviews: one per party per finished deal (rental released / resolved /
// missing, or purchase released / resolved / completed). The server fills
// in author details and keeps the reviewed user's rating up to date.

import type { Review } from '../types'
import { db, requireUserId, unwrap } from './client'

export async function submitReview(input: {
  rating: number
  comment?: string
  rentalId?: string
  transactionId?: string
}): Promise<Review> {
  const row = unwrap(
    await db().rpc('submit_review', {
      p_rating: input.rating,
      p_comment: input.comment,
      p_rental_id: input.rentalId,
      p_transaction_id: input.transactionId,
    }),
  )
  return {
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? '',
    role: row.role as Review['role'],
    rating: Number(row.rating),
    comment: row.comment ?? '',
    date: row.date,
  }
}

/** Reviews about a user (their profile page). */
export async function listReviewsFor(userId: string): Promise<Review[]> {
  const rows = unwrap(
    await db().from('reviews').select('*').eq('subject_id', userId).order('created_at', { ascending: false }),
  )
  return rows.map((row) => ({
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? '',
    role: row.role as Review['role'],
    rating: Number(row.rating),
    comment: row.comment ?? '',
    date: row.date,
  }))
}

/**
 * The signed-in user's own review of one deal, or null if they haven't
 * reviewed it yet (used to hide "Rate the other party" once done).
 */
export async function getMyReviewForDeal(target: { rentalId?: string; transactionId?: string }): Promise<Review | null> {
  const uid = await requireUserId()
  let query = db().from('reviews').select('*').eq('author_id', uid)
  if (target.rentalId) query = query.eq('rental_id', target.rentalId)
  else if (target.transactionId) query = query.eq('transaction_id', target.transactionId)
  else return null
  const row = unwrap(await query.limit(1))[0]
  if (!row) return null
  return {
    id: row.id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? '',
    role: row.role as Review['role'],
    rating: Number(row.rating),
    comment: row.comment ?? '',
    date: row.date,
  }
}

/**
 * Ids of every rental and purchase the signed-in user has already reviewed,
 * in one query (lists like /rentals and /dashboard/orders hide "Rate" for them).
 */
export async function listMyReviewedDealIds(): Promise<Set<string>> {
  const uid = await requireUserId()
  const rows = unwrap(
    await db().from('reviews').select('rental_id, transaction_id').eq('author_id', uid),
  )
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.rental_id) ids.add(row.rental_id)
    if (row.transaction_id) ids.add(row.transaction_id)
  }
  return ids
}
