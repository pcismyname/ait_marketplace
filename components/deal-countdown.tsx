'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatDateTime, formatRemaining } from '@/lib/deal-status'
import { cn } from '@/lib/utils'

/** The current time, re-read every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

/**
 * A live countdown to a stored deadline (dispute_window_ends_at, payout_at,
 * due_date). Calls `onElapsed` once when the deadline passes while the page is open.
 */
export function DealCountdown({
  to,
  label,
  elapsedLabel,
  hint,
  onElapsed,
  tone = 'primary',
}: {
  /** ISO timestamp from the database. */
  to: string
  label: string
  /** Shown instead of the clock once the deadline has passed. */
  elapsedLabel: string
  hint?: string
  onElapsed?: () => void
  tone?: 'primary' | 'attention'
}) {
  const now = useNow(1000)
  const target = new Date(to).getTime()
  const remaining = target - now
  const elapsed = remaining <= 0
  const fired = useRef(false)
  const startedElapsed = useRef(elapsed)

  useEffect(() => {
    // Only fire for deadlines that pass while the page is open.
    if (elapsed && !startedElapsed.current && !fired.current) {
      fired.current = true
      onElapsed?.()
    }
  }, [elapsed, onElapsed])

  return (
    <div
      className={cn(
        'border p-4',
        tone === 'attention'
          ? 'border-amber-300/60 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          : 'border-primary/20 bg-primary-muted/60',
      )}
    >
      <p className="label-tag flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3 w-3" />
        {label}
      </p>
      <p
        className="mt-1 font-display text-2xl font-bold tabular-nums"
        aria-live="polite"
        data-testid="countdown"
      >
        {elapsed ? elapsedLabel : formatRemaining(remaining)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {elapsed ? 'Passed' : 'Ends'} {formatDateTime(to)}
        {hint ? ` · ${hint}` : ''}
      </p>
    </div>
  )
}
