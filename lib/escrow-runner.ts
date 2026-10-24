// One throttle for every client-side call to run_escrow_jobs (docs/Database.md §8).
//
// Callers:
// - lib/store.tsx loadAll (sign-in, page load, every refresh()) → maybeRunEscrowJobs()
//   skips the call when the jobs ran in the last MIN_GAP_MS.
// - components/escrow-job-runner.tsx → runs at most every RUN_INTERVAL_MS while visible.
// - Pages hitting a deadline → requestEscrowRun(), which waits for the gap instead of skipping.
// - Admin demo tools call the RPC directly (to show its errors), then noteEscrowRun().
//
// The last-run time is shared across tabs through localStorage. After each run
// ESCROW_RAN_EVENT is dispatched on window with the EscrowJobResult so pages
// that show money (wallet, transaction) can reload.

import { runEscrowJobs, type EscrowJobResult } from '@/lib/api'

export const ESCROW_RAN_EVENT = 'pio:escrow-jobs-ran'
export const RUN_INTERVAL_MS = 5 * 60_000
export const MIN_GAP_MS = 20_000
const STORAGE_KEY = 'pio:escrow-last-run'

let lastRunMemory = 0
let inFlight: Promise<EscrowJobResult | null> | null = null
let waiting: Promise<EscrowJobResult | null> | null = null

export function readLastRun(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    return Math.max(lastRunMemory, Number.isFinite(stored) ? stored : 0)
  } catch {
    return lastRunMemory
  }
}

function writeLastRun(at: number) {
  lastRunMemory = at
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at))
  } catch {
    // Storage blocked: the in-memory value still throttles this tab.
  }
}

/** Record a run made elsewhere (admin demo tools call the RPC directly to show its errors). */
export function noteEscrowRun(result: EscrowJobResult) {
  writeLastRun(Date.now())
  window.dispatchEvent(new CustomEvent<EscrowJobResult>(ESCROW_RAN_EVENT, { detail: result }))
}

/** Run now (joins a run already in flight). Resolves null on failure. */
export function runEscrowJobsNow(): Promise<EscrowJobResult | null> {
  if (inFlight) return inFlight
  writeLastRun(Date.now())
  inFlight = runEscrowJobs()
    .then((result) => {
      window.dispatchEvent(new CustomEvent<EscrowJobResult>(ESCROW_RAN_EVENT, { detail: result }))
      return result
    })
    .catch((error: unknown) => {
      console.warn('run_escrow_jobs:', error instanceof Error ? error.message : error)
      return null
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Run unless the jobs ran in the last MIN_GAP_MS (then resolve null at once). */
export function maybeRunEscrowJobs(): Promise<EscrowJobResult | null> {
  if (inFlight) return inFlight
  if (Date.now() - readLastRun() < MIN_GAP_MS) return Promise.resolve(null)
  return runEscrowJobsNow()
}

/**
 * Ask for an early run (a deadline just passed). Runs now, or as soon as the
 * MIN_GAP_MS throttle allows. Only call it while signed in.
 */
export function requestEscrowRun(): Promise<EscrowJobResult | null> {
  if (inFlight) return inFlight
  if (waiting) return waiting
  const wait = MIN_GAP_MS - (Date.now() - readLastRun())
  if (wait > 0) {
    waiting = new Promise((resolve) => {
      window.setTimeout(() => {
        waiting = null
        resolve(runEscrowJobsNow())
      }, wait)
    })
    return waiting
  }
  return runEscrowJobsNow()
}
