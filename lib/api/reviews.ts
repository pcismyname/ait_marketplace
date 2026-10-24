// Reviews: one per party per finished deal (rental released / resolved /
// missing, or purchase released / resolved / completed). The server fills
// in author details and keeps the reviewed user's rating up to date.

import type { Review } from '../types'
import { db, unwrap } from './client'

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
