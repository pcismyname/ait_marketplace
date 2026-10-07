'use client'

import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import {
  ChevronRight, MapPin, MessageCircle, ShieldCheck,
  BadgeCheck, HandCoins, Clock, Heart, ChevronDown,
  ChevronUp, Store, Repeat, CreditCard, Package
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { getUser, getSellerReviews, categoryLabel, CONDITION_LABELS } from '@/lib/data'
import { computeRentalQuote, RENTAL_COMMISSION_RATE } from '@/lib/fees'
import { formatPrice, relativeTime, initials } from '@/lib/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Rating } from '@/components/rating'
import { ContactSellerDialog } from '@/components/contact-seller-dialog'
import { ProductCard } from '@/components/listing-card'
import { ImagePlaceholder } from '@/components/image-placeholder'
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
  const router = useRouter()
  const { listings, favoriteIds, toggleFavorite } = useMarketplace()

  const listing = listings.find((l) => l.id === id)

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
  const isRented = listing.status === 'rented'
  const isFav = favoriteIds.has(listing.id)
  const quote = isRent ? computeRentalQuote({ price: listing.price, deposit: listing.deposit }) : null
  const related = listings
    .filter((l) => l.category === listing.category && l.id !== listing.id && l.status === 'available')
    .slice(0, 4)
  const sellerListings = listings
    .filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id && l.status === 'available')
    .slice(0, 4)

  const [activeImg, setActiveImg] = useState(0)
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
                    Held in escrow by AIT Circular — returned once you confirm the item came back
                    in good condition.
                  </p>
                )}
                <p className="mt-2">
                  At booking you pay the rental fee plus a {Math.round(RENTAL_COMMISSION_RATE * 100)}%
                  platform commission and a small escrow handling fee. The owner receives the full rental price.
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
                Total at booking: <strong>{formatPrice(quote.totalDueNow)}</strong> — rental fee,
                platform commission, escrow fee, and refundable deposit. The deposit is returned
                when you confirm the item is back in good condition.
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="mt-5 space-y-2">
            {isRent ? (
              isRented ? (
                <Button size="lg" className="w-full" disabled>
                  <Clock className="h-4 w-4 mr-2" aria-hidden />
                  Rented out
                </Button>
              ) : (
                <Link href={`/listing/${listing.id}/checkout`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  <HandCoins className="h-4 w-4 mr-2" aria-hidden />
                  Request to rent · {formatPrice(quote?.totalDueNow ?? listing.price)}
                </Link>
              )
            ) : (
              listing.status === 'sold' ? (
                <Button size="lg" className="w-full" disabled>
                  <Package className="h-4 w-4 mr-2" aria-hidden />
                  Sold out
                </Button>
              ) : (
                <Link href={`/listing/${listing.id}/checkout`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  <CreditCard className="h-4 w-4 mr-2" aria-hidden />
                  Buy now · {formatPrice(listing.price)}
                </Link>
              )
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
