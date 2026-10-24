'use client'

// Runs the escrow jobs (owner payouts, auto-release, overdue / missing,
// window reminders; docs/Database.md §8) while a signed-in user has the app
// open, so a demo never waits for pg_cron's 10-minute schedule.
//
// - Mounted once in app/layout.tsx. Renders nothing.
// - The store already calls run_escrow_jobs on sign-in (lib/store.tsx
//   loadAll), so the runner counts that as a run and waits a full interval.
// - At most one run per RUN_INTERVAL_MS across all open tabs (the last run
//   time is shared through localStorage), and only while the tab is visible.
// - Pages can ask for an early run with requestEscrowRun(), e.g. when a
//   countdown reaches zero; it is throttled to one per MIN_GAP_MS.
// - After each run it dispatches ESCROW_RAN_EVENT on window with the
//   EscrowJobResult, so pages showing money (wallet, transaction) can reload.

import { useEffect } from 'react'
import { runEscrowJobs, type EscrowJobResult } from '@/lib/api'
import { useMarketplace } from '@/lib/store'

export const ESCROW_RAN_EVENT = 'pio:escrow-jobs-ran'

const RUN_INTERVAL_MS = 5 * 60_000
const MIN_GAP_MS = 20_000
const CHECK_EVERY_MS = 30_000
const STORAGE_KEY = 'pio:escrow-last-run'

let lastRunMemory = 0
let inFlight: Promise<EscrowJobResult | null> | null = null
let waiting: Promise<EscrowJobResult | null> | null = null

function readLastRun(): number {
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

function run(): Promise<EscrowJobResult | null> {
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

/**
 * Ask for an early run (a deadline just passed). Runs now, or as soon as the
 * MIN_GAP_MS throttle allows. Resolves with the result, or null on failure.
 * Only call it while signed in.
 */
export function requestEscrowRun(): Promise<EscrowJobResult | null> {
  if (inFlight) return inFlight
  if (waiting) return waiting
  const wait = MIN_GAP_MS - (Date.now() - readLastRun())
  if (wait > 0) {
    waiting = new Promise((resolve) => {
      window.setTimeout(() => {
        waiting = null
        resolve(run())
      }, wait)
    })
    return waiting
  }
  return run()
}

export function EscrowJobRunner() {
  const { currentUserId } = useMarketplace()

  useEffect(() => {
    if (!currentUserId) return
    // The store just ran the jobs for this sign-in / page load.
    writeLastRun(Math.max(readLastRun(), Date.now()))

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - readLastRun() >= RUN_INTERVAL_MS) void run()
    }
    const timer = window.setInterval(tick, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [currentUserId])

  return null
}
