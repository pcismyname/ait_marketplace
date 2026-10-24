// The scheduled escrow work (owner payouts, overdue / missing, auto-release,
// 24 h / 2 h reminders). pg_cron runs it every 10 minutes where available;
// the app also calls it lazily (the store does on sign-in) so a demo never
// waits for the cron. Idempotent and safe to call often.

import { db, unwrap } from './client'

export interface EscrowJobResult {
  overdue: number
  missing: number
  rentalsReleased: number
  payouts: number
  salesReleased: number
  reminderChecks: number
  /** True when another run was already in progress. */
  skipped?: boolean
}

export async function runEscrowJobs(): Promise<EscrowJobResult> {
  return unwrap(await db().rpc('run_escrow_jobs')) as unknown as EscrowJobResult
}
