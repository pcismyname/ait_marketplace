'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BadgeCheck, Inbox, MessageCircle, Star } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { computeRentalQuote } from '@/lib/fees'
import { formatPrice, initials, relativeTime } from '@/lib/format'
import type { Rental } from '@/lib/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { RentalCard } from '@/components/rentals/rental-card'
import { DemoPaymentsNote } from '@/components/rentals/demo-payments-note'
import { RespondRequestActions, approveBlockedReason } from '@/components/rentals/respond-request-actions'
import { OPEN_PHASES, rentalQuote } from '@/components/rentals/rental-helpers'
import { useNow } from '@/components/rentals/use-now'

/**
 * Owner view of one rental listing's booking requests (respond_rental), plus
 * the bookings that are approved, paid or running. Notifications for new
 * requests link here (docs/Database.md §1).
 */
export default function ListingRequestsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings, rentals, currentUserId, loading, refresh, getUser } = useMarketplace()
  const now = useNow()
  const listing = listings.find((l) => l.id === id)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const forListing = useMemo(
    () =>
      rentals
        .filter((r) => r.listingId === id)
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    [rentals, id],
  )

  if (!listing) {
    return (
      <p className="py-16 text-center text-[13px] text-muted-foreground">
        {loading ? 'Loading…' : 'Listing not found.'}
      </p>
    )
  }

  if (listing.sellerId !== currentUserId) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] font-medium">Only the owner can see booking requests for this listing.</p>
        <Link href={`/listing/${listing.id}`} className="mt-3 inline-block text-[13px] text-primary hover:underline">
          ← Back to the listing
        </Link>
      </div>
    )
  }

  const pending = forListing.filter((r) => r.phase === 'requested')
  const inProgress = forListing.filter((r) => OPEN_PHASES.has(r.phase) && r.phase !== 'requested')
  const past = forListing.filter((r) => !OPEN_PHASES.has(r.phase))
  const listingQuote = listing.type === 'rent' ? computeRentalQuote({ price: listing.price, deposit: listing.deposit }) : null

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/my-listings')} className="mt-1 h-8 w-8 shrink-0" aria-label="Back to my listings">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="label-tag">Booking requests</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{listing.title}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {listingQuote
              ? `${formatPrice(listing.price)} ${listing.rentalPeriod ?? ''} · ${formatPrice(listingQuote.deposit)} deposit · listing is ${listing.status}`
              : 'This listing is for sale, so it has no booking requests.'}
          </p>
          <Link href="/rentals?view=lending" className="mt-2 inline-block text-[12px] text-primary hover:underline underline-offset-2">
            All requests for your items →
          </Link>
        </div>
      </div>

      <section data-testid="pending-requests">
        <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold">
          <Inbox className="h-4 w-4 text-primary" />
          Waiting for your answer{pending.length > 0 ? ` · ${pending.length}` : ''}
        </h2>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
            <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
            <p className="mt-3 text-[14px] font-medium">No pending requests</p>
            <p className="mt-1 text-[12px] text-muted-foreground">New requests appear here and in your notifications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <RequestRow
                key={r.id}
                rental={r}
                renter={getUser(r.renterId)}
                blockedReason={approveBlockedReason(r, rentals, listing.status)}
              />
            ))}
          </div>
        )}
      </section>

      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-4 text-[13px] font-semibold">Approved and running</h2>
          <div className="space-y-3">
            {inProgress.map((r) => (
              <RentalCard key={r.id} rental={r} role="owner" listing={listing} now={now} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-[13px] font-semibold">Past requests and rentals</h2>
          <div className="space-y-3">
            {past.map((r) => (
              <RentalCard key={r.id} rental={r} role="owner" listing={listing} now={now} />
            ))}
          </div>
        </section>
      )}

      <DemoPaymentsNote />
    </div>
  )
}

function RequestRow({
  rental,
  renter,
  blockedReason,
}: {
  rental: Rental
  renter: ReturnType<ReturnType<typeof useMarketplace>['getUser']>
  blockedReason: string | null
}) {
  const quote = rentalQuote(rental)
  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="request-row" data-rental-id={rental.id}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-1 gap-4">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            <AvatarFallback className="bg-primary-muted text-[11px] font-bold text-primary">
              {initials(renter.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/profile/${renter.id}`} className="text-[14px] font-semibold hover:underline underline-offset-2">
                {renter.name}
              </Link>
              <span className="flex items-center gap-0.5 rounded-sm bg-surface-tinted px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <BadgeCheck className="h-3 w-3" />
                AIT verified
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
              {[renter.program, renter.batch].filter(Boolean).join(' · ') || 'AIT member'}
              {renter.reviewsCount > 0 ? (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-current text-primary" />
                  {renter.rating.toFixed(1)} ({renter.reviewsCount})
                </span>
              ) : (
                <span>· no reviews yet</span>
              )}
            </p>
            {rental.requestMessage ? (
              <p className="mt-2 rounded-md border border-border/50 bg-muted/50 p-2 text-[13px] italic text-muted-foreground">
                “{rental.requestMessage}”
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-muted-foreground">No message.</p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Requested {relativeTime(rental.requestedAt)} · they pay {formatPrice(quote.totalDueNow)} after approval (you
              get the {formatPrice(rental.rentalFee)} rental fee; the {formatPrice(rental.deposit)} deposit is held by the
              platform)
            </p>
          </div>
        </div>
        <RespondRequestActions rental={rental} blockedReason={blockedReason} className="shrink-0" />
      </div>
    </div>
  )
}
