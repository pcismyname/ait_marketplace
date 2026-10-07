'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Plus, Eye, Pencil, Pause, Play, CircleCheck, Trash2,
  MessageCircle, MoreHorizontal, PackageSearch,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { getUser } from '@/lib/data'
import { formatPrice, relativeTime } from '@/lib/format'
import type { Listing, ListingStatus } from '@/lib/types'
import { ImagePlaceholder } from '@/components/image-placeholder'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const ILLUSTRATION_EXT = ['.svg']
function isIllustration(src: string) {
  return ILLUSTRATION_EXT.some((e) => src.toLowerCase().endsWith(e))
}
function hasRealImage(src: string) {
  return src && src !== '/placeholder.svg' && !isIllustration(src)
}

type StatusFilter = 'all' | 'available' | 'rented' | 'sold' | 'paused'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Active' },
  { value: 'rented', label: 'Rented out' },
  { value: 'sold', label: 'Sold' },
  { value: 'paused', label: 'Paused' },
]

const STATUS_COLORS: Record<ListingStatus, string> = {
  available: 'text-primary',
  rented: 'text-surge-foreground',
  sold: 'text-muted-foreground',
  reserved: 'text-muted-foreground',
  paused: 'text-muted-foreground',
}
const STATUS_LABELS: Record<ListingStatus, string> = {
  available: 'Active',
  rented: 'Rented out',
  sold: 'Sold',
  reserved: 'Reserved',
  paused: 'Paused',
}

export default function MyListingsPage() {
  const { listings, currentUserId, updateListingStatus, deleteListing, threads } = useMarketplace()

  const myListings = listings.filter((l) => l.sellerId === currentUserId)
  const [tab, setTab] = useState<StatusFilter>('all')
  const [toDelete, setToDelete] = useState<Listing | null>(null)

  const visible = tab === 'all' ? myListings : myListings.filter((l) => l.status === tab)

  const counts: Record<StatusFilter, number> = {
    all: myListings.length,
    available: myListings.filter((l) => l.status === 'available').length,
    rented: myListings.filter((l) => l.status === 'rented').length,
    sold: myListings.filter((l) => l.status === 'sold').length,
    paused: myListings.filter((l) => l.status === 'paused').length,
  }

  // Count open threads per listing
  const threadsByListing = Object.fromEntries(
    threads
      .filter((t) => myListings.some((l) => l.id === t.listingId))
      .map((t) => [t.listingId, t]),
  )

  function onMarkSold(listing: Listing) {
    updateListingStatus(listing.id, 'sold')
    toast.success('Marked as sold', { description: listing.title })
  }
  function onPause(listing: Listing) {
    updateListingStatus(listing.id, 'paused')
    toast('Listing paused', { description: 'It won\'t appear in browse until you republish.' })
  }
  function onRepublish(listing: Listing) {
    updateListingStatus(listing.id, 'available')
    toast.success('Listing republished', { description: listing.title })
  }
  function onDelete(listing: Listing) {
    deleteListing(listing.id)
    setToDelete(null)
    toast('Listing deleted', { description: listing.title })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My listings</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {myListings.length} item{myListings.length !== 1 ? 's' : ''} posted by you
          </p>
        </div>
        <Link
          href="/sell"
          className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          List item
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-border no-scrollbar">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'relative shrink-0 px-4 pb-3 text-[12px] font-semibold uppercase tracking-wider transition-colors',
              tab === value
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-foreground after:content-[""]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {counts[value] > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Listing grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 mt-6">
          {visible.map((listing) => {
            const hasImage = hasRealImage(listing.images[0])
            const hasThread = !!threadsByListing[listing.id]
            const isRent = listing.type === 'rent'

            return (
              <div key={listing.id} className="group flex flex-col">
                {/* Thumbnail */}
                <Link
                  href={`/listing/${listing.id}`}
                  className="relative aspect-[3/4] w-full overflow-hidden bg-surface-tinted block"
                  tabIndex={-1}
                  aria-hidden
                >
                  {hasImage ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <ImagePlaceholder category={listing.category} aspectClass="h-full w-full" />
                  )}
                </Link>

                {/* Info */}
                <div className="mt-3 flex flex-col min-w-0">
                  <Link
                    href={`/listing/${listing.id}`}
                    className="truncate text-[13px] font-medium leading-snug hover:underline underline-offset-2 text-foreground"
                  >
                    {listing.title}
                  </Link>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">
                    {formatPrice(listing.price)}
                    {isRent && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        {listing.rentalPeriod}
                      </span>
                    )}
                  </p>

                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cn('text-[11px] font-semibold uppercase tracking-wider', STATUS_COLORS[listing.status])}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>
                  
                  {listing.viewCount && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {listing.viewCount} views
                    </p>
                  )}

                  {/* Actions row */}
                  <div className="mt-3 flex gap-2">
                    {/* Quick: primary action based on status */}
                    {listing.status === 'available' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPause(listing)}
                        className="flex-1 h-8 text-[11px] rounded-sm px-2"
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                    )}
                    {listing.status === 'paused' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onRepublish(listing)}
                        className="flex-1 h-8 text-[11px] rounded-sm px-2"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Republish
                      </Button>
                    )}
                    {listing.status !== 'available' && listing.status !== 'paused' && (
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/listing/${listing.id}`} />}
                        className="flex-1 h-8 text-[11px] rounded-sm px-2"
                      >
                        View
                      </Button>
                    )}

                    {/* Overflow menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-sm" />
                        }
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-sm p-1">
                        <DropdownMenuItem
                          render={<Link href={`/listing/${listing.id}`} />}
                          className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View listing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={<Link href={`/sell?edit=${listing.id}`} />}
                          className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        {listing.status === 'available' && (
                          <DropdownMenuItem
                            onClick={() => onPause(listing)}
                            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Pause listing
                          </DropdownMenuItem>
                        )}
                        {listing.status === 'paused' && (
                          <DropdownMenuItem
                            onClick={() => onRepublish(listing)}
                            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Republish
                          </DropdownMenuItem>
                        )}
                        {listing.status === 'available' && (
                          <DropdownMenuItem
                            onClick={() => onMarkSold(listing)}
                            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                          >
                            <CircleCheck className="h-3.5 w-3.5" />
                            Mark as sold
                          </DropdownMenuItem>
                        )}
                        {hasThread && (
                          <DropdownMenuItem
                            render={<Link href="/chat" />}
                            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            View messages
                          </DropdownMenuItem>
                        )}
                        <div className="my-1 border-t border-border" />
                        <DropdownMenuItem
                          onClick={() => setToDelete(listing)}
                          className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px] text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center py-24 text-center">
          <PackageSearch className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="mt-5 text-[15px] font-medium">
            {tab === 'all'
              ? "You haven't listed anything yet"
              : `No ${STATUS_LABELS[tab as ListingStatus]?.toLowerCase()} listings`}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {tab === 'all'
              ? 'List furniture, electronics, books, or bikes for the AIT community.'
              : 'Switch tabs to see all your listings.'}
          </p>
          {tab === 'all' && (
            <Link
              href="/sell"
              className="mt-5 flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              List your first item
            </Link>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently remove{' '}
              <strong>&ldquo;{toDelete?.title}&rdquo;</strong> from the marketplace.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => toDelete && onDelete(toDelete)}
            >
              Delete listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
