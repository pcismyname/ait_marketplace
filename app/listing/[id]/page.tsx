'use client'

import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronRight, MapPin, ShieldCheck,
  BadgeCheck, HandCoins, Clock, Heart, ChevronDown,
  ChevronUp, Store, Repeat, CreditCard, Package, Inbox, ArrowRight
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, getSellerReviews, categoryLabel, CONDITION_LABELS } from '@/lib/data'
import {
  computeRentalQuote,
  computeSaleQuote,
  BUYER_PROTECTION_BASE_FEE,
  BUYER_PROTECTION_RATE,
  DISPUTE_WINDOW_HOURS,
  ESCROW_FEE_MIN,
  ESCROW_FEE_RATE,
  OWNER_PAYOUT_DELAY_HOURS,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice, relativeTime, initials } from '@/lib/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Rating } from '@/components/rating'
import { ContactSellerDialog } from '@/components/contact-seller-dialog'
import { ProductCard } from '@/components/listing-card'
import { ImagePlaceholder } from '@/components/image-placeholder'
import { RequestBookingDialog } from '@/components/rentals/request-booking-dialog'
import { OPEN_PHASES, PHASE_META, TONE_CLASS, rentalQuote } from '@/components/rentals/rental-helpers'
import type { Listing } from '@/lib/types'
import { cn } from '@/lib/utils'

const ILLUSTRATION_EXT = ['.svg']
function isIllustration(src: string) {
  return ILLUSTRATION_EXT.some((e) => src.toLowerCase().endsWith(e))
}
function hasRealImage(src: string) {
  return src && src !== '/placeholder.svg' && !isIllustration(src)
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-[13px] font-semibold text-left hover:text-primary transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <div className="pb-5 text-[13px] leading-relaxed text-muted-foreground text-pretty">{children}</div>}
    </div>
  )
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { listings, favoriteIds, toggleFavorite, getUser, currentUserId } = useMarketplace()

  const listing = listings.find((l) => l.id === id)
  const [activeImg, setActiveImg] = useState(0)

  if (!listing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center md:px-6">
        <p className="text-lg font-semibold">Listing not found</p>
        <p className="mt-1 text-[13px] text-muted-foreground">It may have been sold or removed.</p>
        <Link href="/browse" className="mt-5 inline-flex items-center text-[13px] text-primary hover:underline underline-offset-2">
          ← Back to browse
        </Link>
      </div>
    )
  }

  const seller = getUser(listing.sellerId)
  const isShop = seller.kind === 'shop'
  const reviews = getSellerReviews(listing.sellerId)
  const isRent = listing.type === 'rent'
  const isFav = favoriteIds.has(listing.id)
  const quote = isRent ? computeRentalQuote({ price: listing.price, deposit: listing.deposit }) : null
  const protectedSale = isRent ? null : computeSaleQuote(listing.price, 'protected')
  const related = listings
    .filter((l) => l.category === listing.category && l.id !== listing.id && l.status === 'available')
    .slice(0, 4)
  const sellerListings = listings
    .filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id && l.status === 'available')
    .slice(0, 4)

  const images = listing.images.filter((img) => hasRealImage(img))
  const displayImages = images.length > 0 ? images : []

  return (
    <div className="w-full px-4 py-12 lg:px-12 xl:px-20 min-h-screen">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/browse" className="hover:text-foreground transition-colors">Browse</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link href={`/browse?category=${listing.category}`} className="hover:text-foreground transition-colors capitalize">
          {categoryLabel(listing.category)}
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="truncate text-foreground">{listing.title}</span>
      </nav>

      {/* Two-column layout */}
      <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.5fr_1fr] lg:gap-24">

        {/* ── Left: image gallery ── */}
        <div className="space-y-3">
          {/* Main image */}
          <div className="relative overflow-hidden bg-surface-tinted">
            {displayImages.length > 0 ? (
              <Image
                src={displayImages[activeImg] ?? displayImages[0]}
                alt={listing.title}
                width={900}
                height={1200}
                className="w-full object-cover"
                priority
                style={{ aspectRatio: '3/4' }}
              />
            ) : (
              <ImagePlaceholder
                category={listing.category}
                aspectClass="aspect-[3/4] w-full"
              />
            )}

            {/* Heart on main image */}
            <button
              onClick={() => toggleFavorite(listing.id)}
              className={cn(
                'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background',
                isFav ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-label={isFav ? 'Remove from favorites' : 'Save'}
            >
              <Heart className={cn('h-5 w-5', isFav && 'fill-current')} />
            </button>

            {/* Status badge */}
            {listing.status !== 'available' && (
              <div className="absolute bottom-3 left-3">
                <span className="rounded-sm bg-background/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm">
                  {listing.status === 'rented' ? 'Rented out' : listing.status}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {displayImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {displayImages.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImg(i)}
                  className={cn(
                    'relative overflow-hidden bg-surface-tinted transition-opacity',
                    activeImg === i ? 'ring-1 ring-foreground' : 'opacity-60 hover:opacity-100',
                  )}
                >
                  <Image
                    src={img}
                    alt={`View ${i + 1}`}
                    width={200}
                    height={267}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Accordions: description, rental terms, condition, item history */}
          <div className="mt-4">
            <Accordion title="About this item" defaultOpen>
              {listing.description}
            </Accordion>

            {isRent && (
              <Accordion title="Rental terms">
                <p>Rental period: <strong>{listing.rentalPeriod}</strong></p>
                {listing.deposit && (
                  <p className="mt-2">
                    Refundable deposit: <strong>{formatPrice(listing.deposit)}</strong>.
                    Held by {BRAND}, never the owner. After the return, either of you has{' '}
                    {DISPUTE_WINDOW_HOURS} hours to report a problem; with no claim the deposit is refunded
                    automatically when that window closes, or at once if the owner confirms good condition.
                  </p>
                )}
                <p className="mt-2">
                  At booking you pay the rental fee plus a {Math.round(RENTAL_COMMISSION_RATE * 100)}%
                  platform commission and an escrow handling fee of{' '}
                  {formatPrice(ESCROW_FEE_MIN)} or {Math.round(ESCROW_FEE_RATE * 100)}% of the deposit,
                  whichever is higher{quote ? <> ({formatPrice(quote.handlingFee)} here)</> : null}. The owner
                  receives the full rental price {OWNER_PAYOUT_DELAY_HOURS} hours after handover.
                </p>
              </Accordion>
            )}

            <Accordion title={`Condition — ${CONDITION_LABELS[listing.condition]}`}>
              <p>Listed as <strong>{CONDITION_LABELS[listing.condition]}</strong>.</p>
              <p className="mt-2">
                {listing.timesChangedHands > 0
                  ? `This item has circulated ${listing.timesChangedHands} time${listing.timesChangedHands === 1 ? '' : 's'} within the AIT community.`
                  : 'This is a new item that has not yet changed hands.'}
              </p>
              {listing.history.length > 0 && (
                <ol className="mt-3 space-y-1.5">
                  {listing.history.map((h, i) => (
                    <li key={i} className="text-[12px]">
                      <span className="font-medium text-foreground">{h.ownerName}</span>
                      {' '}· {h.action} · <span className="opacity-70">{h.date}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Accordion>

            <Accordion title="Pickup & location">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span><strong>{listing.pickupLocation}</strong> — arrange with the {isShop ? 'shop' : 'seller'} via messages.</span>
              </div>
            </Accordion>
          </div>
        </div>

        {/* ── Right: sticky info panel ── */}
        <div className="lg:sticky lg:top-24 lg:self-start">

          {/* Type label + title */}
          <p className="font-semibold uppercase tracking-widest text-[11px] text-muted-foreground mb-4">
            {isRent ? 'For rent' : 'For sale'} &middot; {categoryLabel(listing.category)}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
            {listing.title}
          </h1>

          {/* Price */}
          <div className="mt-4">
            <p className="text-2xl font-bold tracking-tight">
              {formatPrice(listing.price)}
              {isRent && (
                <span className="ml-2 text-[14px] font-normal text-muted-foreground">
                  {listing.rentalPeriod}
                </span>
              )}
            </p>
            {isRent && listing.deposit && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                + {formatPrice(listing.deposit)} refundable deposit
              </p>
            )}
          </div>

          {/* Escrow note for rentals */}
          {isRent && quote && (
            <div className="mt-4 flex items-start gap-2 rounded-sm border border-surge/20 bg-surge-surface p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
              <p className="text-[12px] leading-relaxed text-surge-foreground">
                Total at booking: <strong>{formatPrice(quote.totalDueNow)}</strong> — rental fee{' '}
                {formatPrice(quote.rentalFee)}, {Math.round(RENTAL_COMMISSION_RATE * 100)}% commission{' '}
                {formatPrice(quote.commission)}, escrow fee {formatPrice(quote.handlingFee)} (the greater of{' '}
                {formatPrice(ESCROW_FEE_MIN)} or {Math.round(ESCROW_FEE_RATE * 100)}% of the deposit) and the{' '}
                {formatPrice(quote.deposit)} refundable deposit, held by {BRAND} until the return.
              </p>
            </div>
          )}

          {/* Payment options for sales (BusinessRules.md §2, §5) */}
          {!isRent && protectedSale && (
            <div className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-surface p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Pay the seller <strong className="text-foreground">in person</strong> for free (no
                protection), or <strong className="text-foreground">pay with protection</strong> for{' '}
                {formatPrice(protectedSale.total)} ({formatPrice(BUYER_PROTECTION_BASE_FEE)} +{' '}
                {Math.round(BUYER_PROTECTION_RATE * 100)}% fee): {BRAND} holds the money until{' '}
                {DISPUTE_WINDOW_HOURS} hours after handover, so you can dispute if it isn&apos;t as described.
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="mt-5 space-y-2">
            {isRent ? (
              <RentCta listing={listing} />
            ) : (
              listing.status === 'sold' || listing.status === 'reserved' ? (
                <Button size="lg" className="w-full" disabled>
                  <Package className="h-4 w-4 mr-2" aria-hidden />
                  {listing.status === 'reserved' ? 'Reserved' : 'Sold out'}
                </Button>
              ) : (
                <Link href={`/listing/${listing.id}/checkout`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  <CreditCard className="h-4 w-4 mr-2" aria-hidden />
                  Buy now · {formatPrice(listing.price)}
                </Link>
              )
            )}
            {listing.sellerId !== currentUserId && (
              <ContactSellerDialog
                listing={listing}
                trigger={
                  <Button size="lg" variant="outline" className="w-full">
                    {isRent ? 'Ask the owner a question' : 'Make an offer'}
                  </Button>
                }
              />
            )}
          </div>

          {/* Condition + location quick facts */}
          <div className="mt-5 space-y-2 border-t border-border pt-5">
            <div className="flex items-center gap-2 text-[13px]">
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Condition:</span>
              <span className="font-medium">{CONDITION_LABELS[listing.condition]}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Pickup at:</span>
              <span className="font-medium">{listing.pickupLocation}</span>
            </div>
            {listing.timesChangedHands > 1 && (
              <div className="flex items-center gap-2 text-[13px]">
                <Repeat className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">Circulated</span>
                <span className="font-medium">{listing.timesChangedHands}× within AIT</span>
              </div>
            )}
          </div>

          {/* Seller block */}
          <div className="mt-5 border-t border-border pt-5">
            <p className="label-tag mb-3">Listed by</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 ring-1 ring-border">
                <AvatarFallback className="bg-primary-muted text-[10px] font-bold text-primary">
                  {isShop ? <Store className="h-4 w-4" /> : initials(seller.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {seller.name}
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{seller.program}</p>
              </div>
              <Rating value={seller.rating} count={seller.reviewsCount} size={12} />
            </div>
            <Link
              href={`/browse?seller=${listing.sellerId}`}
              className="mt-3 inline-flex items-center text-[12px] text-primary hover:underline underline-offset-2"
            >
              See all listings from {seller.name.split(' ')[0]} →
            </Link>
          </div>

          {/* Posted date */}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Listed {relativeTime(listing.createdAt)}
          </p>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold">Reviews for {seller.name.split(' ')[0]}</h2>
            <Rating value={seller.rating} count={seller.reviewsCount} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary-muted text-[9px] font-bold text-primary">
                      {initials(r.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[12px] font-medium">{r.authorName}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground capitalize">{r.role} · {r.date}</span>
                </div>
                <Rating value={r.rating} size={11} />
                <p className="text-[13px] leading-relaxed text-muted-foreground text-pretty">{r.comment}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* More from this seller */}
      {sellerListings.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <h2 className="mb-5 text-base font-semibold">
            More from {seller.name.split(' ')[0]}
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {sellerListings.map((l) => <ProductCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      {/* You may also like */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-10">
          <h2 className="mb-5 text-base font-semibold">
            More in {categoryLabel(listing.category)}
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((l) => <ProductCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Rental call to action (BusinessRules §4: request → owner approves → pay).
 * Shows the viewer's own booking when there is one, the owner's request
 * inbox to the owner, and "Request to book" otherwise.
 */
function RentCta({ listing }: { listing: Listing }) {
  const { rentals, currentUserId, cancelRental } = useMarketplace()
  const [busy, setBusy] = useState(false)

  if (listing.sellerId === currentUserId) {
    const forListing = rentals.filter((r) => r.listingId === listing.id)
    const pending = forListing.filter((r) => r.phase === 'requested').length
    const running = forListing.filter((r) => OPEN_PHASES.has(r.phase) && r.phase !== 'requested').length
    return (
      <div className="space-y-2" data-testid="owner-cta">
        <Link
          href={`/dashboard/listings/${listing.id}/requests`}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          <Inbox className="h-4 w-4 mr-2" aria-hidden />
          {pending > 0 ? `Booking requests · ${pending} waiting` : 'Booking requests'}
        </Link>
        <p className="text-center text-[11px] text-muted-foreground">
          This is your listing{running > 0 ? ` · ${running} booking${running === 1 ? '' : 's'} in progress` : ''}.
        </p>
      </div>
    )
  }

  const mine = rentals
    .filter((r) => r.listingId === listing.id && r.renterId === currentUserId)
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  const open = mine.find((r) => OPEN_PHASES.has(r.phase))

  if (open) {
    const meta = PHASE_META[open.phase]
    const total = rentalQuote(open).totalDueNow
    const cancel = async () => {
      setBusy(true)
      try {
        await cancelRental(open.id)
        toast('Request cancelled', { description: 'Nothing was paid.' })
      } catch (error) {
        toast.error('Could not cancel the request', {
          description: error instanceof Error ? error.message : String(error),
        })
      } finally {
        setBusy(false)
      }
    }
    return (
      <div className="space-y-2 rounded-sm border border-border bg-surface p-3.5" data-testid="my-booking" data-phase={open.phase}>
        <p className="text-[12px]">
          Your booking: <strong className={TONE_CLASS[meta.tone]}>{meta.label}</strong>
        </p>
        {open.phase === 'requested' && (
          <>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Sent {relativeTime(open.requestedAt)}. The owner approves first; then you pay {formatPrice(total)} here.
            </p>
            <Button size="lg" variant="outline" className="w-full" onClick={cancel} disabled={busy}>
              Cancel request
            </Button>
          </>
        )}
        {open.phase === 'approved' && (
          <Link
            href={`/listing/${listing.id}/checkout?rental=${open.id}`}
            className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
          >
            <HandCoins className="h-4 w-4 mr-2" aria-hidden />
            Approved · pay {formatPrice(total)}
          </Link>
        )}
        {open.phase !== 'requested' && open.phase !== 'approved' && (
          <Link href="/rentals?view=renting" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'w-full')}>
            Track it in My Rentals
            <ArrowRight className="h-4 w-4 ml-2" aria-hidden />
          </Link>
        )}
      </div>
    )
  }

  const lastDeclined = mine[0]?.phase === 'declined' ? mine[0] : undefined
  if (listing.status !== 'available') {
    return (
      <Button size="lg" className="w-full" disabled>
        <Clock className="h-4 w-4 mr-2" aria-hidden />
        {listing.status === 'rented'
          ? 'Rented out'
          : listing.status === 'reserved'
            ? 'Reserved for another booking'
            : 'Not available right now'}
      </Button>
    )
  }
  return (
    <div className="space-y-2">
      {lastDeclined && (
        <p className="text-[11px] text-muted-foreground">
          Your last request was declined{lastDeclined.declineReason ? `: “${lastDeclined.declineReason}”` : '.'}
        </p>
      )}
      <RequestBookingDialog
        listing={listing}
        trigger={
          <Button size="lg" className="w-full" data-testid="request-to-book">
            <HandCoins className="h-4 w-4 mr-2" aria-hidden />
            Request to book
          </Button>
        }
      />
      <p className="text-center text-[11px] text-muted-foreground">Free to request · you pay only after the owner approves</p>
    </div>
  )
}
