// Sales (BusinessRules §5). In person: no escrow, no dispute; the seller marks
// it sold. With protection: paid → handed-over → released 48 h later (or when
// the buyer confirms), unless the buyer disputes.
//
//   createSale(…, 'in-person')    buyer    → pending (listing unchanged)
//   createSale(…, 'protected', m) buyer    → paid (price held, listing reserved)
//   confirmSaleHandover           either   paid → handed-over (48 h window)
//   confirmSaleReceipt            buyer    paid | handed-over → released (seller paid now)
//   markSold                      seller   pending (or none) → completed, listing sold
//   cancelSale                    either   pending → cancelled

import type { SaleQuote, SalePaymentMode } from '../fees'
import type { PaymentMethod, Transaction } from '../types'
import { db, subscribeToTable, unwrap, unwrapMaybe } from './client'
import { mapTransaction, type TransactionRow } from './mappers'

/** Server-side quote (same numbers as computeSaleQuote in lib/fees.ts). */
export async function quoteSale(price: number, mode: SalePaymentMode): Promise<SaleQuote> {
  const data = unwrap(await db().rpc('quote_sale', { p_price: price, p_mode: mode }))
  return data as unknown as SaleQuote
}

/** Start a purchase. `method` is required for 'protected', ignored for 'in-person'. */
export async function createSale(
  listingId: string,
  mode: SalePaymentMode,
  method?: PaymentMethod,
): Promise<Transaction> {
  return mapTransaction(
    unwrap(await db().rpc('create_sale', { p_listing_id: listingId, p_mode: mode, p_method: method })),
  )
}

export async function confirmSaleHandover(transactionId: string, photos: string[] = []): Promise<Transaction> {
  return mapTransaction(
    unwrap(await db().rpc('confirm_sale_handover', { p_transaction_id: transactionId, p_photos: photos })),
  )
}

/** Buyer is happy: release the money to the seller now. */
export async function confirmSaleReceipt(transactionId: string): Promise<Transaction> {
  return mapTransaction(unwrap(await db().rpc('confirm_sale_receipt', { p_transaction_id: transactionId })))
}

/**
 * Seller marks a sale listing sold (paid in person). Pass the buyer to
 * complete their pending purchase and credit the item history.
 */
export async function markSold(listingId: string, buyerId?: string): Promise<Transaction> {
  return mapTransaction(unwrap(await db().rpc('mark_sold', { p_listing_id: listingId, p_buyer_id: buyerId })))
}

/** Drop a pending in-person purchase (protected payments can't be cancelled). */
export async function cancelSale(transactionId: string): Promise<Transaction> {
  return mapTransaction(unwrap(await db().rpc('cancel_sale', { p_transaction_id: transactionId })))
}

/** Purchases and sales of the signed-in user (admins: all), newest first. */
export async function listMyTransactions(): Promise<Transaction[]> {
  const rows = unwrap(await db().from('transactions').select('*').order('created_at', { ascending: false }))
  return rows.map(mapTransaction)
}

export async function listTransactionsForListing(listingId: string): Promise<Transaction[]> {
  const rows = unwrap(
    await db().from('transactions').select('*').eq('listing_id', listingId).order('created_at', { ascending: false }),
  )
  return rows.map(mapTransaction)
}

export async function getTransaction(transactionId: string): Promise<Transaction | null> {
  const row = unwrapMaybe(await db().from('transactions').select('*').eq('id', transactionId).maybeSingle())
  return row ? mapTransaction(row) : null
}

export function subscribeToTransactions(onChange: (tx: Transaction) => void): () => void {
  return subscribeToTable<TransactionRow>('transactions', (row, event) => {
    if (event !== 'DELETE') onChange(mapTransaction(row))
  })
}
