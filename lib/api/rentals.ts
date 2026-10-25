// Rentals (BusinessRules §4). Every state change is an RPC that checks who
// is calling and which phase the rental is in; see docs/Database.md.
//
//   requestRental      renter   listing available       → requested
//   respondRental      owner    requested               → approved | declined
//   cancelRental       either   requested | approved    → cancelled
//   payRental          renter   approved                → paid   (deposit + fee held)
//   confirmHandover    renter   paid                    → active (photo required; due date + payout clock start)
//   markReturned       either   active | overdue        → return-pending (48 h window) | missing
//   confirmReturn      owner    return-pending | active | overdue → released (early release)
//   run_escrow_jobs    anyone   → overdue, missing, auto-release, owner payout, reminders

import type { RentalQuote } from '../fees'
import type { PaymentMethod, Rental } from '../types'
import { db, subscribeToTable, unwrap, unwrapMaybe } from './client'
import { mapRental, type RentalRow } from './mappers'

/** Server-side quote (same numbers as computeRentalQuote in lib/fees.ts). */
export async function quoteRental(price: number, deposit?: number): Promise<RentalQuote> {
  const data = unwrap(await db().rpc('quote_rental', { p_price: price, p_deposit: deposit }))
  return data as unknown as RentalQuote
}

/** Ask the owner to rent a listing. The quote is computed and stored now. */
export async function requestRental(listingId: string, message?: string): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('request_rental', { p_listing_id: listingId, p_message: message })))
}

/** Owner approves (listing becomes reserved) or declines a request. */
export async function respondRental(rentalId: string, approve: boolean, reason?: string): Promise<Rental> {
  return mapRental(
    unwrap(await db().rpc('respond_rental', { p_rental_id: rentalId, p_approve: approve, p_reason: reason })),
  )
}

/** Renter or owner cancels a booking that isn't paid yet. */
export async function cancelRental(rentalId: string, reason?: string): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('cancel_rental', { p_rental_id: rentalId, p_reason: reason })))
}

/**
 * Renter pays totalDueNow (simulated, BusinessRules §7). 'wallet' needs
 * enough available balance; otherwise the RPC refuses with a clear message.
 */
export async function payRental(rentalId: string, method: PaymentMethod): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('pay_rental', { p_rental_id: rentalId, p_method: method })))
}

/** Either party confirms the handover. `photos` are dispute-evidence paths (lib/api/storage.ts). */
export async function confirmHandover(rentalId: string, photos: string[] = []): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('confirm_handover', { p_rental_id: rentalId, p_photos: photos })))
}

/** Either party records the return; the late fee is fixed and the 48 h window opens. */
export async function markReturned(rentalId: string, photos: string[] = []): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('mark_returned', { p_rental_id: rentalId, p_photos: photos })))
}

/** Owner confirms good condition: the deposit (minus any late fee) is released now. */
export async function confirmReturn(rentalId: string, photos: string[] = []): Promise<Rental> {
  return mapRental(unwrap(await db().rpc('confirm_return', { p_rental_id: rentalId, p_photos: photos })))
}

/** Rentals where the signed-in user is the renter or the owner (admins: all), newest first. */
export async function listMyRentals(): Promise<Rental[]> {
  const rows = unwrap(await db().from('rentals').select('*').order('created_at', { ascending: false }))
  return rows.map(mapRental)
}

/** Booking requests and rentals for one listing (owner view). */
export async function listRentalsForListing(listingId: string): Promise<Rental[]> {
  const rows = unwrap(
    await db().from('rentals').select('*').eq('listing_id', listingId).order('requested_at', { ascending: false }),
  )
  return rows.map(mapRental)
}

export async function getRental(rentalId: string): Promise<Rental | null> {
  const row = unwrapMaybe(await db().from('rentals').select('*').eq('id', rentalId).maybeSingle())
  return row ? mapRental(row) : null
}

/** Live updates for the user's rentals (RLS-filtered). Returns an unsubscribe function. */
export function subscribeToRentals(onChange: (rental: Rental) => void): () => void {
  return subscribeToTable<RentalRow>('rentals', (row, event) => {
    if (event !== 'DELETE') onChange(mapRental(row))
  })
}
