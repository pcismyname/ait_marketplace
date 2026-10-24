// Simulated wallet (BusinessRules §7, §8): no real money moves. The ledger
// records every hold, payout, refund and payment; balances are sums of it.
//   held       money the platform holds for you (deposits, payouts not yet released)
//   available  your in-app wallet (refunds, payouts); pay with method 'wallet'
//   external   paid in by PromptPay / card (history only)

import type { LedgerEntry, WalletSummary } from '../types'
import { db, unwrap } from './client'
import { mapLedgerEntry } from './mappers'

export async function getWalletSummary(): Promise<WalletSummary> {
  const rows = unwrap(await db().rpc('get_wallet_summary'))
  const row = rows[0]
  return {
    held: Number(row?.held ?? 0),
    available: Number(row?.available ?? 0),
    pendingPayouts: Number(row?.pending_payouts ?? 0),
    depositsHeld: Number(row?.deposits_held ?? 0),
  }
}

/** The user's ledger rows, newest first. */
export async function listLedger(limit = 100): Promise<LedgerEntry[]> {
  const rows = unwrap(
    await db().from('wallet_ledger').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  return rows.map(mapLedgerEntry)
}

/** Simulated withdrawal of available balance to the user's bank. */
export async function withdraw(amount: number): Promise<LedgerEntry> {
  return mapLedgerEntry(unwrap(await db().rpc('wallet_withdraw', { p_amount: amount })))
}
