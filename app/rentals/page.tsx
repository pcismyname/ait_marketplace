'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  ShieldCheck,
  HandCoins,
  CircleCheck,
  TriangleAlert,
  Clock,
  ArrowRight,
  Send,
  BadgeCheck,
  Wallet,
  Scale,
  CalendarClock,
  PackageX,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { getUser } from '@/lib/data'
import type { Listing, Rental, RentalPhase } from '@/lib/types'
import {
  DISPUTE_WINDOW_HOURS,
  MISSING_AFTER_DAYS,
  OWNER_PAYOUT_DELAY_HOURS,
  dailyLateFee,
  daysLate,
  returnStatus,
  settleDeposit,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

const PHASE_META: Record<RentalPhase, { label: string; color: string; icon: typeof Clock }> = {
  requested:        { label: 'Requested',               color: 'text-muted-foreground', icon: Send },
  approved:         { label: 'Approved',                color: 'text-primary',          icon: BadgeCheck },
  paid:             { label: 'Paid · deposit held',     color: 'text-primary',          icon: Wallet },
  active:           { label: 'Active',                  color: 'text-primary',          icon: Clock },
  'return-pending': { label: 'Return pending',          color: 'text-amber-700',        icon: HandCoins },
  released:         { label: 'Deposit released',        color: 'text-primary',          icon: CircleCheck },
  disputed:         { label: 'Dispute open',            color: 'text-destructive',      icon: TriangleAlert },
  resolved:         { label: 'Dispute resolved',        color: 'text-muted-foreground', icon: Scale },
  overdue:          { label: 'Overdue',                 color: 'text-amber-700',        icon: CalendarClock },
  missing:          { label: 'Missing',                 color: 'text-destructive',      icon: PackageX },
}

/** Phases in which PassItOn still holds the renter's deposit (BusinessRules.md §4, §7). */
const DEPOSIT_HELD: ReadonlySet<RentalPhase> = new Set<RentalPhase>([
  'paid',
  'active',
  'return-pending',
  'disputed',
  'overdue',
])

/**
 * Overdue and missing are derived here from the due date and never written to
 * the database: the Supabase `rentals.phase` column may only accept the
 * original four values (active / return-pending / released / disputed).
 */
function effectivePhase(rental: Rental, now: Date): RentalPhase {
  if (rental.phase !== 'active') return rental.phase
  const status = returnStatus(new Date(rental.dueDate), now)
  return status === 'on-time' ? 'active' : status
}

/** Late fee accrued so far, taken from the deposit and capped at it (§4, §6). */
function lateFeeSoFar(rental: Rental, listing: Listing, now: Date) {
  const rentalFee = rental.quote?.rentalFee ?? listing.price
  const perDay = dailyLateFee(rentalFee, listing.rentalPeriod)
  const days = daysLate(new Date(rental.dueDate), now)
  return { perDay, days, ...settleDeposit(rental.deposit, perDay * days) }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RentalsPage() {
  const { rentals, listings, setRentalPhase } = useMarketplace()
  // One clock per visit, so every card agrees on what "late" means.
  const [now] = useState(() => new Date())

  const totalHeld = rentals
    .filter((r) => DEPOSIT_HELD.has(effectivePhase(r, now)))
    .reduce((sum, r) => sum + r.deposit, 0)

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Page header */}
      <div className="mb-16">
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Rentals</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Track rented items and deposits held in escrow
        </p>
      </div>

      {/* Escrow summary strip */}
      {totalHeld > 0 && (
        <div className="mb-10 flex items-center gap-5 rounded-xl bg-primary-muted p-5">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Total held in escrow</p>
            <p className="text-2xl font-semibold text-foreground">{formatPrice(totalHeld)}</p>
          </div>
          <p className="ml-auto hidden max-w-sm text-[12px] text-muted-foreground sm:block text-right leading-relaxed">
            Deposits are held by PassItOn, never by the owner. After the return, the owner confirms the
            condition and the deposit is released; with no claim, it releases automatically
            after {DISPUTE_WINDOW_HOURS} hours. The owner&apos;s rental fee is paid {OWNER_PAYOUT_DELAY_HOURS} hours
            after handover if no dispute is filed.
          </p>
        </div>
      )}

      {/* Rental grid */}
      {rentals.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rentals.map((rental) => {
            const listing = listings.find((l) => l.id === rental.listingId)
            if (!listing) return null
            const owner = getUser(listing.sellerId)
            const phase = effectivePhase(rental, now)
            const meta = PHASE_META[phase]
            const Icon = meta.icon
            const late = phase === 'overdue' ? lateFeeSoFar(rental, listing, now) : null

            // Only the original four phases are written to the database (see effectivePhase).
            const onPhase = (next: 'return-pending' | 'released' | 'disputed') => {
              const from = phase
              setRentalPhase(rental.id, next)
              if (next === 'return-pending') {
                toast('Marked as returned', {
                  description: late && late.toOwner > 0
                    ? `Waiting for the owner to confirm. ${formatPrice(late.toOwner)} late fee comes out of the deposit.`
                    : `Waiting for the owner to confirm. With no claim, the deposit releases after ${DISPUTE_WINDOW_HOURS} hours.`,
                })
              }
              if (next === 'released' && from === 'disputed') {
                toast.success('Dispute resolved', { description: 'The admin settled the deposit (simulated).' })
              } else if (next === 'released') {
                toast.success('Deposit released', { description: `${formatPrice(rental.deposit)} refunded.` })
              }
              if (next === 'disputed') toast.error('Dispute opened', { description: 'The deposit stays held until an admin decides.' })
            }

            return (
              <div key={rental.id} className="group flex flex-col">
                {/* Image */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-tinted">
                  <Link href={`/listing/${listing.id}`} className="absolute inset-0">
                    <Image
                      src={listing.images[0] || '/placeholder.svg'}
                      alt={listing.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  </Link>
                  {/* Phase badge */}
                  <span className={cn(
                    'absolute bottom-2 left-2 flex items-center gap-1 rounded-sm bg-background/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-sm',
                    meta.color,
                  )}>
                    <Icon className="h-2.5 w-2.5" />
                    {meta.label}
                  </span>
                </div>

                {/* Info */}
                <div className="mt-2 flex flex-col min-w-0">
                  <Link
                    href={`/listing/${listing.id}`}
                    className="truncate text-[13px] font-medium leading-snug hover:underline underline-offset-2 text-foreground"
                  >
                    {listing.title}
                  </Link>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    From {owner.name} · {listing.rentalPeriod}
                  </p>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">
                    Deposit: {formatPrice(rental.deposit)}
                  </p>
                  <p className={cn('text-[10px]', phase === 'overdue' || phase === 'missing' ? meta.color : 'text-muted-foreground')}>
                    Due {formatDate(rental.dueDate)}
                  </p>

                  {late && (
                    <p className="mt-1 text-[11px] leading-snug text-amber-700">
                      {late.days} {late.days === 1 ? 'day' : 'days'} late · {formatPrice(late.perDay)}/day.
                      Late fee so far: {formatPrice(late.toOwner)} from the deposit.
                    </p>
                  )}
                  {phase === 'missing' && (
                    <p className="mt-1 text-[11px] leading-snug text-destructive">
                      More than {MISSING_AFTER_DAYS} days late: counted as missing. The full deposit
                      ({formatPrice(rental.deposit)}) goes to the owner.
                    </p>
                  )}
                  {phase === 'return-pending' && (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      The owner checks the condition against the handover photos. With no claim, the
                      deposit releases {DISPUTE_WINDOW_HOURS} hours after the return.
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-2.5">
                    {(phase === 'active' || phase === 'overdue') && (
                      <button
                        onClick={() => onPhase('return-pending')}
                        className="w-fit text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Mark returned
                      </button>
                    )}
                    {phase === 'return-pending' && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => onPhase('released')}
                          className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
                        >
                          Confirm &amp; release
                        </button>
                        <button
                          onClick={() => onPhase('disputed')}
                          className="text-[11px] font-semibold uppercase tracking-wider text-destructive hover:opacity-80 transition-opacity"
                        >
                          Report damage
                        </button>
                      </div>
                    )}
                    {phase === 'disputed' && (
                      <button
                        onClick={() => onPhase('released')}
                        className="w-fit text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Resolve dispute
                      </button>
                    )}
                    {phase === 'released' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <CircleCheck className="h-3 w-3" />
                        {formatPrice(rental.deposit)} refunded
                      </span>
                    )}
                    {(phase === 'disputed' || phase === 'overdue' || phase === 'missing') && (
                      <Link href="/chat" className="flex items-center gap-1 text-[10px] text-primary hover:underline underline-offset-2">
                        <ArrowRight className="h-3 w-3" />
                        Message owner
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-24 text-center">
          <HandCoins className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="mt-5 text-[14px] font-medium">No active rentals</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Rent furniture, appliances or gear for the semester.</p>
          <Link
            href="/?type=rent"
            className="mt-5 flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse rentals
          </Link>
        </div>
      )}
    </div>
  )
}
