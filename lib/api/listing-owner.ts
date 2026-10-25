// Owner-side listing calls: premium placement (BusinessRules §2, a simulated
// ฿49 charge for 7 days; migration 20261025020401_premium_placement.sql) and
// the admin-hidden flag the owner dashboard shows (20261025020300).
// Clients can't write listings.featured / featured_until directly.

import type { Listing, PaymentMethod } from '../types'
import { db, unwrap } from './client'
import { mapListing } from './mappers'

/** Pay ฿49 (simulated) for 7 days at the top of browse and search. */
export async function enablePremiumPlacement(listingId: string, method: PaymentMethod): Promise<Listing> {
  return mapListing(unwrap(await db().rpc('enable_premium_placement', { p_listing_id: listingId, p_method: method })))
}

/** End premium placement early. No refund. */
export async function endPremiumPlacement(listingId: string): Promise<Listing> {
  return mapListing(unwrap(await db().rpc('end_premium_placement', { p_listing_id: listingId })))
}

export interface HiddenFlag {
  hiddenAt: string
  reason?: string
}

/** The seller's listings an admin has hidden, by listing id. */
export async function getHiddenListings(sellerId: string): Promise<Map<string, HiddenFlag>> {
  const rows = unwrap(
    await db().from('listings').select('id, hidden_at, hidden_reason').eq('seller_id', sellerId).not('hidden_at', 'is', null),
  )
  return new Map(
    rows.map((row) => [row.id, { hiddenAt: row.hidden_at as string, reason: row.hidden_reason ?? undefined }]),
  )
}
