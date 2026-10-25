// What an owner may do with a listing by hand, mirroring the database's
// listing guard (docs/Database.md §2, public.listing_has_open_deal and
// public.listing_has_history). The database stays the authority: these only
// let the UI explain a refusal before the owner clicks.

import type { Listing, ListingStatus, Rental, RentalPhase, SaleStatus, Transaction } from './types'

const OPEN_RENTAL: RentalPhase[] = ['approved', 'paid', 'active', 'return-pending', 'disputed', 'overdue']
const OPEN_SALE: SaleStatus[] = ['paid', 'handed-over', 'disputed']
const NO_HISTORY_RENTAL: RentalPhase[] = ['requested', 'declined', 'cancelled']
const NO_HISTORY_SALE: SaleStatus[] = ['pending', 'cancelled']

export interface ListingLocks {
  /** A booking or protected sale is in progress: the status changes automatically. */
  openDeal: boolean
  /** The rental or sale in progress (open its status page at /transaction/<id>). */
  openDealId?: string
  /** Rental or sale history: can't be deleted (pause it instead). */
  hasHistory: boolean
  /** Rental requests waiting for the owner. */
  pendingRequests: Rental[]
  /** In-person purchase intents waiting for the seller (mark_sold picks one). */
  pendingPurchases: Transaction[]
}

export function listingLocks(listing: Listing, rentals: Rental[], transactions: Transaction[]): ListingLocks {
  const myRentals = rentals.filter((r) => r.listingId === listing.id)
  const mySales = transactions.filter((t) => t.listingId === listing.id)
  const openDealId =
    myRentals.find((r) => OPEN_RENTAL.includes(r.phase))?.id ?? mySales.find((t) => OPEN_SALE.includes(t.status))?.id
  return {
    openDeal: openDealId !== undefined,
    openDealId,
    hasHistory:
      myRentals.some((r) => !NO_HISTORY_RENTAL.includes(r.phase)) || mySales.some((t) => !NO_HISTORY_SALE.includes(t.status)),
    pendingRequests: myRentals.filter((r) => r.phase === 'requested'),
    pendingPurchases: mySales.filter((t) => t.status === 'pending' && t.mode === 'in-person'),
  }
}

export const OPEN_DEAL_MESSAGE =
  'A booking or protected sale is in progress, so the status changes automatically. You can still edit the details.'
export const HISTORY_MESSAGE =
  'This listing has rental or sale history, so it can’t be deleted. Pause it instead.'

/** The history lock, worded for the status (pausing is offered only for active listings). */
export function historyMessage(status: ListingStatus): string {
  if (status === 'available') return HISTORY_MESSAGE
  if (status === 'paused') return 'This listing has rental or sale history, so it can’t be deleted. It stays paused and hidden from browse.'
  return 'This listing has rental or sale history, so it can’t be deleted.'
}

export const PENDING_TYPE_MESSAGE =
  'Rental requests or purchase requests are waiting, so the type can’t change. Decline them first.'
