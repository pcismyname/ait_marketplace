'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FastForward, FlaskConical } from 'lucide-react'
import { runEscrowJobs, timeTravel } from '@/lib/api'
import { DISPUTE_WINDOW_HOURS, OWNER_PAYOUT_DELAY_HOURS } from '@/lib/fees'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Demo tools: move a rental or purchase back in time (admin_time_travel), then
 * run the escrow jobs so payouts, auto-release, overdue and reminders happen
 * now instead of in 48 hours. For live demos only.
 */
export function DemoTools({
  dealId,
  onDone,
  className,
}: {
  dealId: string | undefined
  onDone?: () => void
  className?: string
}) {
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (h: number) => {
    if (!dealId) return
    if (!Number.isFinite(h) || h <= 0) {
      toast.error('Enter a positive number of hours.')
      return
    }
    setBusy(true)
    try {
      const kind = await timeTravel(dealId, h)
      const result = await runEscrowJobs()
      const did = [
        result.payouts && `${result.payouts} payout${result.payouts === 1 ? '' : 's'}`,
        result.rentalsReleased && `${result.rentalsReleased} rental deposit${result.rentalsReleased === 1 ? '' : 's'} released`,
        result.salesReleased && `${result.salesReleased} sale${result.salesReleased === 1 ? '' : 's'} released`,
        result.overdue && `${result.overdue} overdue`,
        result.missing && `${result.missing} missing`,
      ].filter(Boolean)
      toast.success(`Moved the ${kind} ${h} h earlier`, {
        description: did.length > 0 ? `Escrow jobs: ${did.join(', ')}.` : 'Escrow jobs ran; nothing was due yet.',
      })
      onDone?.()
    } catch (error) {
      toast.error('Time travel failed', { description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={cn('rounded-xl border border-dashed border-amber-400/70 bg-amber-50/60 p-5 dark:bg-amber-500/5', className)}
      data-testid="demo-tools"
    >
      <div className="mb-1 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <h2 className="text-[14px] font-semibold">Demo tools</h2>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
        For demos only. Moves this deal&apos;s timestamps back so the {DISPUTE_WINDOW_HOURS}-hour dispute window or the{' '}
        {OWNER_PAYOUT_DELAY_HOURS}-hour owner payout passes now, then runs the escrow jobs. An open dispute keeps the money
        held until you resolve it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {[1, 24, DISPUTE_WINDOW_HOURS].map((h) => (
          <Button key={h} variant="outline" size="sm" disabled={!dealId || busy} onClick={() => go(h)}>
            <FastForward className="h-3.5 w-3.5" />+{h} h
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="hours"
            aria-label="Hours to fast-forward"
            className="h-7 w-20 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <Button variant="outline" size="sm" disabled={!dealId || busy || !hours} onClick={() => go(Number(hours))}>
            Go
          </Button>
        </div>
      </div>
    </section>
  )
}
