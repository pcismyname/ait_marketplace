// A "deal" is a rental or a sale. Notifications link to /transaction/<id>
// for both, so that page resolves the id with getDeal().

import type { Rental, Transaction } from '../types'
import { getRental } from './rentals'
import { getTransaction } from './sales'

export type Deal = { kind: 'rental'; rental: Rental } | { kind: 'sale'; transaction: Transaction }

export async function getDeal(id: string): Promise<Deal | null> {
  const [rental, transaction] = await Promise.all([getRental(id), getTransaction(id)])
  if (rental) return { kind: 'rental', rental }
  if (transaction) return { kind: 'sale', transaction }
  return null
}
