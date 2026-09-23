import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Repeat, Store, Sparkles } from 'lucide-react'
import type { Listing, ListingStatus } from '@/lib/types'
import { getUser, CONDITION_LABELS, categoryLabel } from '@/lib/data'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Partial<Record<ListingStatus, string>> = {
  rented: 'Rented out',
  sold: 'Sold',
  reserved: 'Reserved',
}

export function ListingCard({ listing }: { listing: Listing }) {
  const seller = getUser(listing.sellerId)
  const isRent = listing.type === 'rent'
  const isShop = seller.kind === 'shop'
  const statusLabel = STATUS_LABELS[listing.status]

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <Image
          src={listing.images[0] || '/placeholder.svg'}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          className={cn(
            'object-cover transition-transform duration-300 group-hover:scale-105',
            statusLabel && 'opacity-60',
          )}
        />
        <span
          className={cn(
            'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold',
            isRent
              ? 'bg-surge text-surge-foreground'
              : 'bg-primary text-primary-foreground',
          )}
        >
          {isRent ? 'For rent' : 'For sale'}
        </span>
        {listing.timesChangedHands > 1 && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground backdrop-blur">
            <Repeat className="h-3 w-3" />
            {listing.timesChangedHands}x
          </span>
        )}
        {statusLabel && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1.5 text-center text-xs font-semibold text-background">
            {statusLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{categoryLabel(listing.category)}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>{CONDITION_LABELS[listing.condition]}</span>
          {listing.featured && (
            <Sparkles className="ml-auto h-3.5 w-3.5 text-surge" aria-label="Premium placement" />
          )}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-balance">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="font-display text-lg font-bold leading-none">
              {formatPrice(listing.price)}
              {isRent && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {listing.rentalPeriod}
                </span>
              )}
            </p>
            {isRent && listing.deposit ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPrice(listing.deposit)} deposit
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {isShop ? (
            <Store className="h-3.5 w-3.5 text-primary" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          <span className="truncate">{isShop ? seller.name : listing.pickupLocation}</span>
        </div>
      </div>
    </Link>
  )
}
