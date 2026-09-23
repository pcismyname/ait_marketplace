'use client'

import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Repeat,
  BadgeCheck,
  HandCoins,
  Store,
  Clock,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import {
  getUser,
  getSellerReviews,
  categoryLabel,
  CONDITION_LABELS,
} from '@/lib/data'
import { computeRentalQuote, RENTAL_COMMISSION_RATE } from '@/lib/fees'
import { formatPrice, relativeTime, initials } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Rating } from '@/components/rating'
import { CategoryIcon } from '@/components/category-icon'
import { ContactSellerDialog } from '@/components/contact-seller-dialog'
import { RentCheckoutDialog } from '@/components/rent-checkout-dialog'
import { ListingCard } from '@/components/listing-card'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings } = useMarketplace()

  const listing = listings.find((l) => l.id === id)

  if (!listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="font-display text-xl font-bold">Listing not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been sold or removed.
        </p>
        <Button render={<Link href="/browse" />} nativeButton={false} className="mt-6">
          Back to browse
        </Button>
      </div>
    )
  }

  const seller = getUser(listing.sellerId)
  const isShop = seller.kind === 'shop'
  const reviews = getSellerReviews(listing.sellerId)
  const isRent = listing.type === 'rent'
  const isRented = listing.status === 'rented'
  const quote = isRent
    ? computeRentalQuote({ price: listing.price, deposit: listing.deposit })
    : null
  const related = listings
    .filter((l) => l.category === listing.category && l.id !== listing.id)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: media + details */}
        <div>
          <div className="relative aspect-4/3 overflow-hidden rounded-3xl border border-border bg-muted">
            <Image
              src={listing.images[0] || '/placeholder.svg'}
              alt={listing.title}
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
              priority
            />
            <span
              className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
                isRent
                  ? 'bg-surge text-surge-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {isRent ? 'For rent' : 'For sale'}
            </span>
            {isRented && (
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Clock className="h-3.5 w-3.5" />
                Currently rented out
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
              <CategoryIcon category={listing.category} className="h-3.5 w-3.5" />
              {categoryLabel(listing.category)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
              {CONDITION_LABELS[listing.condition]}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              Listed {relativeTime(listing.createdAt)}
            </span>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-lg font-bold">About this item</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground text-pretty">
              {listing.description}
            </p>
          </div>

          {/* Lifecycle / history */}
          <div className="mt-8 rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-bold">Item history</h2>
              <span className="ml-auto rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                {listing.timesChangedHands}x within AIT
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {listing.timesChangedHands === 0
                ? 'New stock: this item has not changed hands in the AIT community yet.'
                : `This item has changed hands ${listing.timesChangedHands} time${
                    listing.timesChangedHands === 1 ? '' : 's'
                  } in the AIT community.`}
            </p>
            <ol className="mt-4 space-y-0">
              {listing.history.map((h, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    {i < listing.history.length - 1 && (
                      <span className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="-mt-0.5">
                    <p className="text-sm font-medium">{h.ownerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.action} · {h.date}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Reviews */}
          <div className="mt-8">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold">
                Reviews for {seller.name}
              </h2>
              <Rating value={seller.rating} count={seller.reviewsCount} />
            </div>
            <div className="mt-4 space-y-3">
              {reviews.length > 0 ? (
                reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                          {initials(r.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{r.authorName}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {r.role} · {r.date}
                        </p>
                      </div>
                      <Rating value={r.rating} size={12} className="ml-auto" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">
                      {r.comment}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: sticky purchase panel */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-border bg-card p-6">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-balance">
              {listing.title}
            </h1>

            <div className="mt-4 flex items-end gap-2">
              <span className="font-display text-3xl font-bold">
                {formatPrice(listing.price)}
              </span>
              {isRent && (
                <span className="pb-1 text-sm text-muted-foreground">
                  {listing.rentalPeriod}
                </span>
              )}
            </div>

            {isRent && quote ? (
              <div className="mt-3 space-y-2 rounded-2xl bg-surge-muted p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
                  <p className="text-xs text-surge-foreground">
                    <span className="font-semibold">
                      {formatPrice(quote.deposit)} refundable deposit
                    </span>{' '}
                    held in escrow and returned after the item comes back in good
                    condition.
                  </p>
                </div>
                <p className="pl-6 text-xs text-surge-foreground/80">
                  Total at booking {formatPrice(quote.totalDueNow)}: rental +{' '}
                  {Math.round(RENTAL_COMMISSION_RATE * 100)}% commission +{' '}
                  {formatPrice(quote.handlingFee)} escrow fee + deposit.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Peer-to-peer sale. No platform fee for buyer or seller.
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Pickup at <span className="font-medium text-foreground">
                {listing.pickupLocation}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {isRent ? (
                isRented ? (
                  <Button size="lg" className="w-full" disabled>
                    <Clock className="h-4 w-4" />
                    Rented out until the next return
                  </Button>
                ) : (
                  <RentCheckoutDialog
                    listing={listing}
                    trigger={
                      <Button size="lg" className="w-full">
                        <HandCoins className="h-4 w-4" />
                        Rent now · {formatPrice(quote?.totalDueNow ?? listing.price)}
                      </Button>
                    }
                  />
                )
              ) : (
                <ContactSellerDialog
                  listing={listing}
                  trigger={
                    <Button size="lg" className="w-full">
                      <MessageCircle className="h-4 w-4" />
                      Message seller
                    </Button>
                  }
                />
              )}
              <ContactSellerDialog
                listing={listing}
                trigger={
                  <Button size="lg" variant="outline" className="w-full">
                    {isRent ? 'Ask the owner a question' : 'Make an offer'}
                  </Button>
                }
              />
            </div>

            {/* Seller */}
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Listed by
              </p>
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 border border-border">
                  <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">
                    {isShop ? <Store className="h-5 w-5" /> : initials(seller.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {seller.name}
                    <BadgeCheck className="h-4 w-4 text-primary" />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {seller.program}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <Rating value={seller.rating} count={seller.reviewsCount} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {isShop ? (
                    <>
                      <Store className="h-3.5 w-3.5" />
                      Campus shop
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified AIT email
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-xl font-bold tracking-tight">
            More in {categoryLabel(listing.category)}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
