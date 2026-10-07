'use client'

import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { ShieldCheck, HandCoins, CircleCheck, TriangleAlert, Clock, ArrowRight } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, getUser, paymentMethodLabel } from '@/lib/data'
import type { Rental, RentalPhase } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

const PHASE_META: Record<RentalPhase, { label: string; color: string; icon: typeof Clock }> = {
  active:           { label: 'Active',                  color: 'text-primary',      icon: Clock },
  'return-pending': { label: 'Return pending',          color: 'text-amber-700',    icon: HandCoins },
  released:         { label: 'Deposit released',        color: 'text-primary',      icon: CircleCheck },
  disputed:         { label: 'Dispute open',            color: 'text-destructive',  icon: TriangleAlert },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RentalsPage() {
  const { rentals, listings, setRentalPhase } = useMarketplace()

  const totalHeld = rentals
    .filter((r) => r.phase === 'active' || r.phase === 'return-pending' || r.phase === 'disputed')
    .reduce((sum, r) => sum + r.deposit, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Page header */}
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="text-lg font-semibold tracking-tight">My rentals</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Track rented items and deposits held in escrow.
        </p>
      </div>

      {/* Escrow summary strip */}
      {totalHeld > 0 && (
        <div className="mb-8 flex items-center gap-4 border-b border-border pb-6">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total held in escrow</p>
            <p className="text-xl font-semibold text-foreground">{formatPrice(totalHeld)}</p>
          </div>
          <p className="ml-auto hidden max-w-xs text-[11px] text-muted-foreground sm:block text-right">
            Deposits are held by {BRAND}, never by the owner, and released once the item is returned in good condition.
          </p>
        </div>
      )}

      {/* Rental grid */}
      {rentals.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rentals.map((rental) => {
            const listing = listings.find((l) => l.id === rental.listingId)
            if (!listing) return null
            const owner = getUser(listing.sellerId)
            const meta = PHASE_META[rental.phase]
            const Icon = meta.icon

            const onPhase = (phase: RentalPhase) => {
              setRentalPhase(rental.id, phase)
              if (phase === 'return-pending') toast('Marked as returned', { description: 'Waiting for owner to confirm.' })
              if (phase === 'released') toast.success('Deposit released', { description: `${formatPrice(rental.deposit)} refunded.` })
              if (phase === 'disputed') toast.error('Dispute opened')
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
                  <p className="text-[10px] text-muted-foreground">Due {formatDate(rental.dueDate)}</p>

                  {/* Actions */}
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {rental.phase === 'active' && (
                      <button
                        onClick={() => onPhase('return-pending')}
                        className="h-7 rounded-sm border border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                      >
                        Mark returned
                      </button>
                    )}
                    {rental.phase === 'return-pending' && (
                      <>
                        <button
                          onClick={() => onPhase('released')}
                          className="h-7 rounded-sm bg-primary text-[10px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                          Confirm &amp; release
                        </button>
                        <button
                          onClick={() => onPhase('disputed')}
                          className="h-7 rounded-sm border border-destructive/40 text-[10px] font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          Report damage
                        </button>
                      </>
                    )}
                    {rental.phase === 'disputed' && (
                      <button
                        onClick={() => onPhase('released')}
                        className="h-7 rounded-sm border border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Resolve dispute
                      </button>
                    )}
                    {rental.phase === 'released' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <CircleCheck className="h-3 w-3" />
                        {formatPrice(rental.deposit)} refunded
                      </span>
                    )}
                    {rental.phase === 'disputed' && (
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
