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
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 border-b border-border pb-6">
        <p className="label-tag mb-1">Rentals & escrow</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          My rentals & deposits
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Track rented items and the deposits held safely in escrow until return.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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
    <div className="group flex flex-col">
      <Link
        href={`/listing/${listing.id}`}
        className="relative aspect-[3/4] w-full overflow-hidden bg-surface-tinted block"
      >
        <Image
          src={listing.images[0] || '/placeholder.svg'}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="mt-3 flex flex-col min-w-0">
        <Link
          href={`/listing/${listing.id}`}
          className="truncate text-[13px] font-medium leading-snug hover:underline underline-offset-2 text-foreground"
        >
          {listing.title}
        </Link>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          From {owner.name}
        </p>

        <div className="mt-1 flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', meta.className.split(' ')[1])} />
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider', meta.className.split(' ')[1])}>
            {meta.label}
          </span>
        </div>

        <p className="text-[13px] font-semibold text-foreground mt-1">
          Deposit: {formatPrice(rental.deposit)}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {rental.phase === 'active' && (
            <Button size="sm" variant="outline" className="w-full text-[11px] h-8 rounded-sm" onClick={() => onPhase('return-pending')}>
              Mark returned
            </Button>
          )}
          {rental.phase === 'return-pending' && (
            <>
              <Button size="sm" className="w-full text-[11px] h-8 rounded-sm" onClick={() => onPhase('released')}>
                Confirm & release
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[11px] h-8 rounded-sm text-destructive hover:text-destructive"
                onClick={() => onPhase('disputed')}
              >
                Report damage
              </Button>
            </>
          )}
          {rental.phase === 'disputed' && (
            <Button size="sm" variant="outline" className="w-full text-[11px] h-8 rounded-sm" onClick={() => onPhase('released')}>
              Resolve dispute
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
