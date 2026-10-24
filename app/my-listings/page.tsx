'use client'

// Owner dashboard: every listing the signed-in user posted, read from the
// database (searchListingsPage, all statuses), with tabs per status. Actions
// go through the store (listings table, guarded by listings_guard) and
// mark_sold for in-person sales (BusinessRules §5). The database refuses
// status changes while a deal is in progress and deleting a listing with
// money history; lib/listing-locks.ts explains those before the click.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Eye, Pencil, Pause, Play, CircleCheck, Trash2, Lock, Sparkles, EyeOff,
  MessageCircle, MoreHorizontal, PackageSearch, AlertCircle, RotateCcw, Loader2, ArrowUpRight,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { searchListingsPage } from '@/lib/api'
import { getHiddenListings, type HiddenFlag } from '@/lib/api/listing-owner'
import { BRAND } from '@/lib/data'
import { formatPrice } from '@/lib/format'
import { OPEN_DEAL_MESSAGE, historyMessage, listingLocks, type ListingLocks } from '@/lib/listing-locks'
import type { Listing, ListingStatus } from '@/lib/types'
import { ImagePlaceholder } from '@/components/image-placeholder'
import { deleteStoredPhotos } from '@/components/photo-uploader'
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

function hasRealImage(src: string | undefined) {
  return Boolean(src) && src !== '/placeholder.svg' && !src!.toLowerCase().endsWith('.svg')
}

type StatusFilter = 'all' | ListingStatus

const STATUS_TABS: { value: StatusFilter; label: string; param: string }[] = [
  { value: 'all', label: 'All', param: 'all' },
  { value: 'available', label: 'Active', param: 'active' },
  { value: 'reserved', label: 'Reserved', param: 'reserved' },
  { value: 'rented', label: 'Rented out', param: 'rented' },
  { value: 'sold', label: 'Sold', param: 'sold' },
  { value: 'paused', label: 'Paused', param: 'paused' },
]

const STATUS_COLORS: Record<ListingStatus, string> = {
  available: 'text-primary',
  rented: 'text-amber-700',
  sold: 'text-muted-foreground',
  reserved: 'text-amber-700',
  paused: 'text-muted-foreground',
}
const STATUS_LABELS: Record<ListingStatus, string> = {
  available: 'Active',
  rented: 'Rented out',
  sold: 'Sold',
  reserved: 'Reserved',
  paused: 'Paused',
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

function MyListingsInner() {
  const {
    currentUserId, loading: storeLoading, rentals, transactions, threads, getUser,
    updateListingStatus, deleteListing,
  } = useMarketplace()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') ?? 'all'
  const tab = STATUS_TABS.find((t) => t.param === tabParam)?.value ?? 'all'

  const [mine, setMine] = useState<Listing[] | null>(null)
  const [hidden, setHidden] = useState<Map<string, HiddenFlag>>(() => new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Listing | null>(null)
  const [toSell, setToSell] = useState<Listing | null>(null)
  const [buyerChoice, setBuyerChoice] = useState<string>('')

  // Load from the database (all statuses), and again after every action.
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    Promise.all([
      searchListingsPage({ sellerId: currentUserId, status: 'all', sort: 'newest', limit: 500 }),
      // Admin moderation flag (the seller can't relist these). Best effort.
      getHiddenListings(currentUserId).catch(() => new Map<string, HiddenFlag>()),
    ]).then(
      ([{ listings }, hiddenFlags]) => {
        if (cancelled) return
        setMine(listings)
        setHidden(hiddenFlags)
        setLoadError(null)
      },
      (error) => {
        if (!cancelled) setLoadError(errorMessage(error))
      },
    )
    return () => { cancelled = true }
  }, [currentUserId, reloadKey])
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Rentals and purchases change through realtime: refresh the list when they do.
  const dealSignature = useMemo(
    () => [...rentals.map((r) => `${r.id}:${r.phase}`), ...transactions.map((t) => `${t.id}:${t.status}`)].join(','),
    [rentals, transactions],
  )
  const lastSignature = useRef(dealSignature)
  useEffect(() => {
    if (lastSignature.current === dealSignature) return
    lastSignature.current = dealSignature
    reload()
  }, [dealSignature, reload])

  const myListings = useMemo(() => mine ?? [], [mine])
  const locksById = useMemo(
    () => new Map(myListings.map((l) => [l.id, listingLocks(l, rentals, transactions)])),
    [myListings, rentals, transactions],
  )
  const visible = tab === 'all' ? myListings : myListings.filter((l) => l.status === tab)
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: myListings.length, available: 0, reserved: 0, rented: 0, sold: 0, paused: 0 }
    for (const l of myListings) c[l.status] += 1
    return c
  }, [myListings])
  const pendingTotal = useMemo(
    () => [...locksById.values()].reduce((n, locks) => n + locks.pendingRequests.length, 0),
    [locksById],
  )

  const threadsByListing = useMemo(() => new Set(threads.map((t) => t.listingId)), [threads])

  const setTab = (value: StatusFilter) => {
    const param = STATUS_TABS.find((t) => t.value === value)?.param ?? 'all'
    const next = new URLSearchParams(searchParams.toString())
    if (param === 'all') next.delete('tab')
    else next.set('tab', param)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  async function run(listing: Listing, action: () => Promise<void>, success: string, failure: string) {
    setBusyId(listing.id)
    try {
      await action()
      toast.success(success, { description: listing.title })
    } catch (error) {
      toast.error(failure, { description: errorMessage(error) })
    } finally {
      setBusyId(null)
      reload()
    }
  }

  const onPause = (listing: Listing) =>
    run(listing, () => updateListingStatus(listing.id, 'paused'), 'Listing paused', 'Could not pause the listing')
  const onUnpause = (listing: Listing) =>
    run(listing, () => updateListingStatus(listing.id, 'available'), 'Listing is active again', 'Could not reactivate the listing')

  const openMarkSold = (listing: Listing) => {
    const pending = locksById.get(listing.id)?.pendingPurchases ?? []
    setBuyerChoice(pending[0]?.buyerId ?? '')
    setToSell(listing)
  }
  const onMarkSold = async () => {
    if (!toSell) return
    const listing = toSell
    setToSell(null)
    await run(
      listing,
      () => updateListingStatus(listing.id, 'sold', buyerChoice || undefined),
      'Marked as sold',
      'Could not mark it as sold',
    )
  }

  const onDelete = async () => {
    if (!toDelete) return
    const listing = toDelete
    setToDelete(null)
    await run(
      listing,
      async () => {
        await deleteListing(listing.id)
        // Like the edit page: the listing's uploaded photos go with it.
        deleteStoredPhotos(listing.images)
      },
      'Listing deleted',
      'Could not delete the listing',
    )
  }

  const loading = storeLoading || (mine === null && !loadError)
  const sellPending = toSell ? locksById.get(toSell.id)?.pendingPurchases ?? [] : []
  const deleteLocks = toDelete ? locksById.get(toDelete.id) : undefined
  const deletePending = deleteLocks ? deleteLocks.pendingRequests.length + deleteLocks.pendingPurchases.length : 0
  const deleteHasChat = toDelete ? threadsByListing.has(toDelete.id) : false

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Page header */}
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="label-tag mb-2">My account</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Listings</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {loading ? 'Loading your listings…' : `${myListings.length} item${myListings.length !== 1 ? 's' : ''} posted by you`}
            {pendingTotal > 0 && (
              <> · <span className="font-semibold text-primary">{pendingTotal} rental request{pendingTotal !== 1 ? 's' : ''} waiting</span></>
            )}
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
      <div role="tablist" aria-label="Listing status" className="mb-12 flex gap-0 overflow-x-auto border-b border-border no-scrollbar pb-2">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
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

      {loadError ? (
        <div className="flex flex-col items-center py-24 text-center" role="alert">
          <AlertCircle className="h-7 w-7 text-destructive/60" strokeWidth={1.25} />
          <p className="mt-5 text-[14px] font-medium">Couldn&apos;t load your listings</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{loadError}</p>
          <button
            onClick={reload}
            className="mt-5 flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] animate-pulse bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((listing) => (
            <OwnerCard
              key={listing.id}
              listing={listing}
              locks={locksById.get(listing.id)}
              hasThread={threadsByListing.has(listing.id)}
              hidden={hidden.get(listing.id)}
              busy={busyId === listing.id}
              onPause={() => onPause(listing)}
              onUnpause={() => onUnpause(listing)}
              onMarkSold={() => openMarkSold(listing)}
              onDelete={() => setToDelete(listing)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-24 text-center">
          <PackageSearch className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="mt-5 text-[14px] font-medium">
            {tab === 'all' ? "You haven't listed anything yet" : `No ${STATUS_LABELS[tab].toLowerCase()} listings`}
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

      {/* Mark as sold (in person, BusinessRules §5) */}
      <Dialog open={!!toSell} onOpenChange={(o) => !o && setToSell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as sold?</DialogTitle>
            <DialogDescription>
              For a sale paid in person. <strong>&ldquo;{toSell?.title}&rdquo;</strong> leaves the marketplace and the
              sale is added to its history. In-person sales have no buyer protection.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="label-tag mb-2">Who bought it?</legend>
            {sellPending.map((tx) => (
              <label key={tx.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <input
                  type="radio"
                  name="buyer"
                  value={tx.buyerId}
                  checked={buyerChoice === tx.buyerId}
                  onChange={() => setBuyerChoice(tx.buyerId ?? '')}
                />
                {getUser(tx.buyerId).name} <span className="text-muted-foreground">· asked to buy in person</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
              <input type="radio" name="buyer" value="" checked={buyerChoice === ''} onChange={() => setBuyerChoice('')} />
              Someone else, or not through {BRAND}
            </label>
            {sellPending.length > 1 && (
              <p className="text-[11px] text-muted-foreground">The other buyers are told the item is gone.</p>
            )}
          </fieldset>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToSell(null)}>Cancel</Button>
            <Button onClick={onMarkSold}>Mark as sold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>&ldquo;{toDelete?.title}&rdquo;</strong> from the marketplace.
              {deletePending > 0 && ' Open requests and purchase intents for it are removed too.'}
              {deleteHasChat && ' Conversations about it are deleted with it.'}
              {(deletePending > 0 || deleteHasChat) && ' The students involved are notified.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete}>Delete listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OwnerCard({
  listing, locks, hasThread, hidden, busy, onPause, onUnpause, onMarkSold, onDelete,
}: {
  listing: Listing
  locks?: ListingLocks
  hasThread: boolean
  /** Hidden by an admin: it can't be relisted (listings_moderation_guard). */
  hidden?: HiddenFlag
  busy: boolean
  onPause: () => void
  onUnpause: () => void
  onMarkSold: () => void
  onDelete: () => void
}) {
  const isRent = listing.type === 'rent'
  const openDeal = locks?.openDeal ?? false
  const hasHistory = locks?.hasHistory ?? false
  const requests = locks?.pendingRequests.length ?? 0
  const canPause = listing.status === 'available' && !openDeal && !hidden
  const canUnpause = listing.status === 'paused' && !openDeal && !hidden
  const canMarkSold = listing.type === 'sale' && listing.status === 'available' && !openDeal
  const itemClass = 'flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]'

  return (
    <div className="group flex flex-col" data-testid="owner-listing" data-listing-id={listing.id}>
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-tinted">
        <Link href={`/listing/${listing.id}`} className="absolute inset-0">
          {hasRealImage(listing.images[0]) ? (
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
        {hidden ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-sm bg-destructive px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
            <EyeOff className="h-2.5 w-2.5" /> Hidden by admin
          </span>
        ) : listing.status !== 'available' && (
          <span className="absolute bottom-2 left-2 rounded-sm bg-background/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground">
            {STATUS_LABELS[listing.status]}
          </span>
        )}
        {listing.featured && listing.status === 'available' && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-sm bg-background/85 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700">
            <Sparkles className="h-2.5 w-2.5" /> Featured
          </span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
          </div>
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', STATUS_COLORS[listing.status])}>
            {STATUS_LABELS[listing.status]}
          </span>
          {listing.viewCount !== undefined && listing.viewCount > 0 && (
            <span className="text-[10px] text-muted-foreground">{listing.viewCount} views</span>
          )}
          {isRent && requests > 0 && (
            <Link
              href={`/dashboard/listings/${listing.id}/requests`}
              className="text-[10px] font-semibold text-primary hover:underline underline-offset-2"
            >
              {requests} request{requests !== 1 ? 's' : ''}
            </Link>
          )}
          {hidden && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-semibold text-destructive"
              title={hidden.reason ? `Reason: ${hidden.reason}` : undefined}
              data-testid="hidden-by-admin"
            >
              <EyeOff className="h-2.5 w-2.5" /> Hidden by admin
            </span>
          )}
          {openDeal && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title={OPEN_DEAL_MESSAGE}>
              <Lock className="h-2.5 w-2.5" /> Deal in progress
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
          <div className="flex gap-3">
            <Link
              href={`/dashboard/listings/${listing.id}/edit`}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Edit
            </Link>
            {canPause && (
              <button
                onClick={onPause}
                disabled={busy}
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                Pause
              </button>
            )}
            {canUnpause && (
              <button
                onClick={onUnpause}
                disabled={busy}
                className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Unpause
              </button>
            )}
            {openDeal && locks?.openDealId && (
              <Link
                href={`/transaction/${locks.openDealId}`}
                className="flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary hover:opacity-80"
              >
                View deal <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
              aria-label={`More actions for ${listing.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-sm p-1">
              <DropdownMenuItem render={<Link href={`/listing/${listing.id}`} />} className={itemClass}>
                <Eye className="h-3.5 w-3.5" />
                View listing
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/dashboard/listings/${listing.id}/edit`} />} className={itemClass}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              {isRent && (
                <DropdownMenuItem render={<Link href={`/dashboard/listings/${listing.id}/requests`} />} className={itemClass}>
                  <PackageSearch className="h-3.5 w-3.5" />
                  Rental requests{requests > 0 ? ` (${requests})` : ''}
                </DropdownMenuItem>
              )}
              {canPause && (
                <DropdownMenuItem onClick={onPause} className={itemClass}>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </DropdownMenuItem>
              )}
              {canUnpause && (
                <DropdownMenuItem onClick={onUnpause} className={itemClass}>
                  <Play className="h-3.5 w-3.5" />
                  Unpause
                </DropdownMenuItem>
              )}
              {canMarkSold && (
                <DropdownMenuItem onClick={onMarkSold} className={itemClass}>
                  <CircleCheck className="h-3.5 w-3.5" />
                  Mark as sold
                </DropdownMenuItem>
              )}
              {hasThread && (
                <DropdownMenuItem render={<Link href="/chat" />} className={itemClass}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  View messages
                </DropdownMenuItem>
              )}
              <div className="my-1 border-t border-border" />
              {hasHistory ? (
                <p className="flex items-start gap-2 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" /> {historyMessage(listing.status)}
                </p>
              ) : (
                <DropdownMenuItem onClick={onDelete} className={cn(itemClass, 'text-destructive focus:text-destructive')}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function MyListingsPage() {
  return (
    <Suspense fallback={null}>
      <MyListingsInner />
    </Suspense>
  )
}
