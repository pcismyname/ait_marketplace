'use client'

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
  Receipt,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, getUser, paymentMethodLabel } from '@/lib/data'
import type { Rental, RentalPhase } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PHASE_META: Record<
  RentalPhase,
  { label: string; className: string; icon: typeof Clock }
> = {
  active: {
    label: 'Rental active',
    className: 'bg-primary/10 text-primary',
    icon: Clock,
  },
  'return-pending': {
    label: 'Return pending confirmation',
    className: 'bg-surge-muted text-surge-foreground',
    icon: HandCoins,
  },
  released: {
    label: 'Deposit released',
    className: 'bg-primary/10 text-primary',
    icon: CircleCheck,
  },
  disputed: {
    label: 'Dispute open',
    className: 'bg-destructive/10 text-destructive',
    icon: TriangleAlert,
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function RentalsPage() {
  const { rentals, listings, setRentalPhase } = useMarketplace()

  const totalHeld = rentals
    .filter((r) => r.phase === 'active' || r.phase === 'return-pending' || r.phase === 'disputed')
    .reduce((sum, r) => sum + r.deposit, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          My rentals & deposits
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track rented items and the deposits held safely in escrow until return.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">Total deposits in escrow</p>
          <p className="font-display text-2xl font-bold">{formatPrice(totalHeld)}</p>
        </div>
        <p className="ml-auto hidden max-w-xs text-xs text-muted-foreground sm:block">
          Deposits are held by {BRAND}, never by the owner, and released back to you once
          the item is returned in good condition.
        </p>
      </div>

      {rentals.length > 0 ? (
        <div className="space-y-4">
          {rentals.map((rental) => (
            <RentalCard
              key={rental.id}
              rental={rental}
              listing={listings.find((l) => l.id === rental.listingId)}
              onPhase={(phase) => {
                setRentalPhase(rental.id, phase)
                if (phase === 'return-pending')
                  toast('Marked as returned', {
                    description: 'Waiting for the owner to confirm condition.',
                  })
                if (phase === 'released')
                  toast.success('Deposit released', {
                    description: `${formatPrice(rental.deposit)} refunded to you.`,
                  })
                if (phase === 'disputed')
                  toast.error('Dispute opened', {
                    description: `${BRAND} will review the item condition.`,
                  })
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <HandCoins className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No active rentals</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rent furniture, appliances or gear for the semester.
          </p>
          <Button
            render={<Link href="/browse?type=rent" />}
            nativeButton={false}
            className="mt-5"
          >
            Browse rentals
          </Button>
        </div>
      )}
    </div>
  )
}

function RentalCard({
  rental,
  listing,
  onPhase,
}: {
  rental: Rental
  listing: ReturnType<typeof useMarketplace>['listings'][number] | undefined
  onPhase: (phase: RentalPhase) => void
}) {
  if (!listing) return null
  const owner = getUser(listing.sellerId)
  const meta = PHASE_META[rental.phase]
  const Icon = meta.icon

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <Link
          href={`/listing/${listing.id}`}
          className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-muted sm:w-28"
        >
          <Image
            src={listing.images[0] || '/placeholder.svg'}
            alt={listing.title}
            fill
            className="object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/listing/${listing.id}`}
                className="font-semibold hover:underline"
              >
                {listing.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Rented from {owner.name} · {listing.rentalPeriod}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                meta.className,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              Deposit held:{' '}
              <span className="font-semibold text-foreground">
                {formatPrice(rental.deposit)}
              </span>
            </span>
            <span>Started {formatDate(rental.startDate)}</span>
            <span>Due {formatDate(rental.dueDate)}</span>
          </div>

          {rental.quote && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
              <Receipt className="h-3 w-3" />
              Paid {formatPrice(rental.quote.totalDueNow)} via{' '}
              {paymentMethodLabel(rental.paymentMethod)} · includes{' '}
              {formatPrice(rental.quote.platformFees)} platform fees
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {rental.phase === 'active' && (
              <Button size="sm" onClick={() => onPhase('return-pending')}>
                Mark item as returned
              </Button>
            )}
            {rental.phase === 'return-pending' && (
              <>
                <Button size="sm" onClick={() => onPhase('released')}>
                  <CircleCheck className="h-4 w-4" />
                  Confirm return & release deposit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onPhase('disputed')}
                >
                  <TriangleAlert className="h-4 w-4" />
                  Report damage
                </Button>
              </>
            )}
            {rental.phase === 'disputed' && (
              <Button size="sm" variant="outline" onClick={() => onPhase('released')}>
                Resolve dispute & refund deposit
              </Button>
            )}
            {rental.phase === 'released' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <CircleCheck className="h-4 w-4" />
                {formatPrice(rental.deposit)} refunded to you
              </span>
            )}
          </div>
        </div>
      </div>

      {rental.phase === 'disputed' && (
        <div className="flex items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-xs text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          A dispute is open. {BRAND} is reviewing the reported damage before deciding how
          much of the deposit to release.
          <Link href="/chat" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">
            Message owner
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
