'use client'

// Runs the escrow jobs (owner payouts, auto-release, overdue / missing,
// window reminders; docs/Database.md §8) while a signed-in user has the app
// open, so a demo never waits for pg_cron's 10-minute schedule.
//
// - Mounted once in app/layout.tsx. Renders nothing.
// - The throttle lives in lib/escrow-runner.ts and is shared with the store
//   (which runs the jobs on sign-in and refresh(), skipping if they just ran),
//   deadline-driven page requests and the admin demo tools.
// - At most one interval run per RUN_INTERVAL_MS across all open tabs, and
//   only while the tab is visible.

import { useEffect } from 'react'
import { useMarketplace } from '@/lib/store'
import { readLastRun, runEscrowJobsNow, RUN_INTERVAL_MS } from '@/lib/escrow-runner'

export { ESCROW_RAN_EVENT, requestEscrowRun } from '@/lib/escrow-runner'

const CHECK_EVERY_MS = 30_000

export function EscrowJobRunner() {
  const { currentUserId } = useMarketplace()

  useEffect(() => {
    if (!currentUserId) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - readLastRun() >= RUN_INTERVAL_MS) void runEscrowJobsNow()
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
