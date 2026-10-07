'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ArrowRight } from 'lucide-react'
import { getSeasonStatus } from '@/lib/seasons'
import { cn } from '@/lib/utils'

const subscribeNoop = () => () => {}

export function SeasonalBanner({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const status  = getSeasonStatus()
  const isMoveOut = status.event.kind === 'move-out'

  const headline = isMoveOut
    ? 'Rooms are clearing out'
    : 'New arrivals settling in'

  const sub = isMoveOut
    ? 'Graduating students are listing desks, fridges, and bikes. Good time to buy.'
    : 'Incoming students are looking for everything. List early and match with pre-arrival needs.'

  const cta = isMoveOut
    ? { href: '/sell', label: 'List what you\'re leaving behind' }
    : { href: '/needs', label: 'Register a pre-arrival need' }

  const countdown = !mounted
    ? status.event.label
    : status.active
      ? 'Happening now'
      : `${status.daysUntil} days to ${status.event.label}`

  return (
    <div className={cn('rounded-xl border border-surge/20 bg-surge-surface', className)}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-display text-[17px] font-bold italic text-surge-foreground">
              {headline}
            </p>
            <span className="rounded-full border border-surge/25 bg-surge/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-surge-foreground">
              {countdown}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-surge-foreground/80 text-pretty">
            {sub}
          </p>
        </div>

        {/* CTA */}
        <Link
          href={cta.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-surge-foreground px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
        >
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
