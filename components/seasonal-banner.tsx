'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { Sparkles, PackageOpen, ArrowRight } from 'lucide-react'
import { getSeasonStatus } from '@/lib/seasons'
import { cn } from '@/lib/utils'

const subscribeNoop = () => () => {}

export function SeasonalBanner({ className }: { className?: string }) {
  // false during SSR and hydration, true once on the client. Keeps the
  // day countdown from causing a hydration mismatch without setting state
  // in an effect.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  const status = getSeasonStatus()
  const isMoveOut = status.event.kind === 'move-out'

  const headline = isMoveOut
    ? status.active
      ? 'Move-out season is here'
      : 'Move-out season is coming'
    : status.active
      ? 'New arrivals are settling in'
      : 'New-arrival season ahead'

  const sub = isMoveOut
    ? 'Graduating students are clearing out rooms — expect a surge of desks, fridges and bikes.'
    : 'Incoming students are furnishing rooms — list early and match with pre-arrival needs.'

  const cta = isMoveOut
    ? { href: '/sell', label: 'List what you are leaving behind' }
    : { href: '/needs', label: 'Register what you need' }

  const Icon = isMoveOut ? PackageOpen : Sparkles

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-surge/30 bg-surge-muted p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surge text-surge-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-surge-foreground">
                {headline}
              </h2>
              <span className="rounded-full bg-surge/25 px-2 py-0.5 text-xs font-semibold text-surge-foreground">
                {!mounted
                  ? status.event.label
                  : status.active
                    ? 'Active now'
                    : `${status.daysUntil} days to ${status.event.label}`}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm text-surge-foreground/80">{sub}</p>
          </div>
        </div>
        <Link
          href={cta.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surge px-4 py-2 text-sm font-semibold text-surge-foreground transition hover:opacity-90"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
