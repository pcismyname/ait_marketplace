'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import type { Listing } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { CONDITION_LABELS } from '@/lib/data'
import { useMarketplace } from '@/lib/store'
import { ImagePlaceholder } from '@/components/image-placeholder'
import { cn } from '@/lib/utils'

// SVG paths that should be treated as "no real photo" → show tinted placeholder
const ILLUSTRATION_EXTENSIONS = ['.svg']
function isIllustration(src: string) {
  return ILLUSTRATION_EXTENSIONS.some((ext) => src.toLowerCase().endsWith(ext))
}

const STATUS_LABELS: Partial<Record<Listing['status'], string>> = {
  rented: 'Rented out',
  sold: 'Sold',
  reserved: 'Reserved',
  paused: 'Paused',
}

export function ProductCard({ listing }: { listing: Listing }) {
  const { favoriteIds, toggleFavorite } = useMarketplace()
  const isFav = favoriteIds.has(listing.id)
  const hasRealImage =
    listing.images[0] &&
    listing.images[0] !== '/placeholder.svg' &&
    !isIllustration(listing.images[0])

  const isRent = listing.type === 'rent'
  const isUnavailable = listing.status !== 'available' && listing.status !== 'paused'
  const statusLabel = STATUS_LABELS[listing.status]

  return (
    <article className="group relative">
      {/* ── Image area — edge-to-edge, no border, no shadow ── */}
      <div className="relative overflow-hidden bg-surface-tinted">
        <Link
          href={`/listing/${listing.id}`}
          className="block aspect-[3/4] w-full"
          tabIndex={-1}
          aria-hidden
        >
          {hasRealImage ? (
            <Image
              src={listing.images[0]}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                'object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]',
                isUnavailable && 'opacity-60 grayscale',
              )}
            />
          ) : (
            <ImagePlaceholder
              category={listing.category}
              aspectClass="aspect-[3/4] w-full"
              className={isUnavailable ? 'opacity-60' : ''}
            />
          )}
        </Link>

        {/* Status overlay — only for unavailable items */}
        {statusLabel && (
          <div className="absolute inset-0 flex items-end justify-start pointer-events-none">
            <span className="m-2 rounded-sm bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm">
              {statusLabel}
            </span>
          </div>
        )}

        {/* Heart icon — top right */}
        <button
          onClick={(e) => { e.preventDefault(); toggleFavorite(listing.id) }}
          className={cn(
            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150',
            'bg-background/70 backdrop-blur-sm hover:bg-background/90',
            isFav ? 'text-primary' : 'text-foreground/50 opacity-0 group-hover:opacity-100',
          )}
          aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
        >
          <Heart className={cn('h-3.5 w-3.5', isFav && 'fill-current')} />
        </button>
      </div>

      {/* ── Minimal text below image — no box, no padding container ── */}
      <div className="mt-2 space-y-0.5">
        <Link href={`/listing/${listing.id}`} className="group/link">
          <h3 className="line-clamp-1 text-[13px] font-medium leading-snug text-foreground group-hover/link:underline underline-offset-2">
            {listing.title}
          </h3>
        </Link>
        <p className="text-[13px] font-semibold text-foreground">
          {formatPrice(listing.price)}
          {isRent && (
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              {listing.rentalPeriod ?? '/ semester'}
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {CONDITION_LABELS[listing.condition]}
          {listing.pickupLocation && (
            <> &middot; {listing.pickupLocation.replace(' Lobby', '').replace(' Building', '')}</>
          )}
        </p>
      </div>
    </article>
  )
}
