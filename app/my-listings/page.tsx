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

function hasRealImage(src: string) {
  return src && src !== '/placeholder.svg' && !src.toLowerCase().endsWith('.svg')
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
  rented: 'text-amber-700',
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
    toast('Listing paused')
  }
  function onRepublish(listing: Listing) {
    updateListingStatus(listing.id, 'available')
    toast.success('Listing republished', { description: listing.title })
  }
  function onDelete(listing: Listing) {
    deleteListing(listing.id)
    setToDelete(null)
    toast('Listing deleted')
  }

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Page header */}
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">My Listings</h1>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            {myListings.length} item{myListings.length !== 1 ? 's' : ''} posted by you
          </p>
        </div>
        <Link
          href="/sell"
          className="flex w-fit items-center gap-1.5 border border-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          <Plus className="h-3 w-3" />
          List an item
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-12 flex gap-0 overflow-x-auto border-b border-border no-scrollbar pb-2">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'relative shrink-0 pb-3 pr-6 text-[11px] font-semibold uppercase tracking-wider transition-colors',
              tab === value
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-6 after:h-[1.5px] after:bg-foreground after:content-[""]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {counts[value] > 0 && (
              <span className="ml-1 text-[10px] tabular-nums opacity-50">
                {counts[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Listing grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((listing) => {
            const hasImage = hasRealImage(listing.images[0])
            const hasThread = !!threadsByListing[listing.id]
            const isRent = listing.type === 'rent'

            return (
              <div key={listing.id} className="group flex flex-col">
                {/* Image */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-tinted">
                  <Link href={`/listing/${listing.id}`} className="absolute inset-0">
                    {hasImage ? (
                      <Image
                        src={listing.images[0]}
                        alt={listing.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <ImagePlaceholder category={listing.category} aspectClass="h-full w-full" />
                    )}
                  </Link>
                  {/* Status overlay */}
                  {listing.status !== 'available' && (
                    <span className="absolute bottom-2 left-2 rounded-sm bg-background/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground">
                      {STATUS_LABELS[listing.status]}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="mt-2 flex flex-col min-w-0">
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
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', STATUS_COLORS[listing.status])}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                    {hasThread && listing.status === 'available' && (
                      <Link href="/chat" className="flex items-center gap-0.5 text-[10px] text-primary hover:underline underline-offset-2">
                        <MessageCircle className="h-2.5 w-2.5" />
                        Message
                      </Link>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                    <div className="flex gap-3">
                      {listing.status === 'available' && (
                        <button
                          onClick={() => onPause(listing)}
                          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Pause
                        </button>
                      )}
                      {listing.status === 'paused' && (
                        <button
                          onClick={() => onRepublish(listing)}
                          className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
                        >
                          Republish
                        </button>
                      )}
                      {(listing.status === 'sold' || listing.status === 'rented') && (
                        <Link
                          href={`/listing/${listing.id}`}
                          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                          View details
                        </Link>
                      )}
                    </div>

                    {/* More menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
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
                          render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}
                          className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={<Link href={`/dashboard/listings/${listing.id}/requests`} />}
                          className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                        >
                          <PackageSearch className="h-3.5 w-3.5" />
                          View requests
                        </DropdownMenuItem>
                        {listing.status === 'available' && (
                          <DropdownMenuItem
                            onClick={() => onPause(listing)}
                            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Pause
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
        <div className="flex flex-col items-center py-24 text-center">
          <PackageSearch className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="mt-5 text-[14px] font-medium">
            {tab === 'all' ? "You haven't listed anything yet" : `No ${STATUS_LABELS[tab as ListingStatus]?.toLowerCase()} listings`}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {tab === 'all' ? 'List furniture, electronics, books, or bikes for the AIT community.' : 'Switch tabs to see all your listings.'}
          </p>
          {tab === 'all' && (
            <Link
              href="/sell"
              className="mt-5 flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              List your first item
            </Link>
          )}
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>&ldquo;{toDelete?.title}&rdquo;</strong> from the marketplace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => toDelete && onDelete(toDelete)}>Delete listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
