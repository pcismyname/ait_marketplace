'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tag, Sparkles, Info, Loader2, Lock, Pause, Play, Trash2, PackageSearch, ArrowLeft } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, PICKUP_LOCATIONS, CONDITION_LABELS, categoryLabel } from '@/lib/data'
import {
  DEPOSIT_MAX, DEPOSIT_MIN, DEPOSIT_VALUE_MAX_RATE, DEPOSIT_VALUE_MIN_RATE,
  ESCROW_FEE_MIN, ESCROW_FEE_RATE, HIGH_VALUE_RENTAL_THRESHOLD,
  PREMIUM_PLACEMENT_DAYS, PREMIUM_PLACEMENT_FEE, RENTAL_COMMISSION_RATE, SALE_COMMISSION_RATE, computeSaleQuote,
  suggestedDeposit,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { OPEN_DEAL_MESSAGE, PENDING_TYPE_MESSAGE, historyMessage, listingLocks } from '@/lib/listing-locks'
import type { CategoryId, Condition, ListingType } from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PhotoUploader, MAX_LISTING_PHOTOS, deleteStoredPhotos } from '@/components/photo-uploader'
import {
  CATEGORY_ITEMS, CONDITION_ITEMS, FormError, listMissing, pct, useListingForm,
} from '@/components/listing-form'
import { PremiumPaymentFields, syncPremiumPlacement } from '@/components/premium-placement'
import { cn } from '@/lib/utils'

const PERIOD_ITEMS = [{ value: 'per semester', label: 'Per Semester (4 months)' }, { value: 'per month', label: 'Per Month' }, { value: 'per week', label: 'Per Week' }]

const STATUS_LABELS = {
  available: 'Active',
  reserved: 'Reserved',
  rented: 'Rented out',
  sold: 'Sold',
  paused: 'Paused',
} as const

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    listings, rentals, transactions, threads, currentUserId, loading, updateListing, updateListingStatus, deleteListing,
    refresh,
  } = useMarketplace()
  const listing = listings.find((l) => l.id === id)
  const form = useListingForm()
  const {
    type, title, description, category, condition, price, deposit, replacementValue, rentalPeriod, pickup, premium,
    premiumMethod, valueRange, suggestion, depositError, escrowFee, highValue, photos,
  } = form

  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyStatus, setBusyStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Fill the form once, when the listing first arrives (not on every refresh).
  // (State adjusted during render, as React recommends over an effect.)
  if (listing && loadedId !== listing.id) {
    setLoadedId(listing.id)
    form.loadFrom(listing)
  }

  const locks = useMemo(
    () => (listing ? listingLocks(listing, rentals, transactions) : null),
    [listing, rentals, transactions],
  )

  if (loading || (listing && loadedId !== listing.id)) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="max-w-2xl space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
        </div>
      </div>
    )
  }

  if (!listing || listing.sellerId !== currentUserId) {
    return (
      <div className="flex flex-col items-center border border-dashed border-border py-20 text-center">
        <PackageSearch className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="mt-4 text-[15px] font-medium">
          {listing ? 'You can only edit your own listings' : 'Listing not found'}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {listing ? 'This item belongs to another student.' : 'It may have been deleted.'}
        </p>
        <Link href="/my-listings" className="mt-5 text-[13px] text-primary hover:underline underline-offset-2">
          ← Back to my listings
        </Link>
      </div>
    )
  }

  const openDeal = locks?.openDeal ?? false
  const hasHistory = locks?.hasHistory ?? false
  const canToggle = !openDeal && (listing.status === 'available' || listing.status === 'paused')
  const pendingCount = (locks?.pendingRequests.length ?? 0) + (locks?.pendingPurchases.length ?? 0)
  const typeLocked = hasHistory || openDeal || pendingCount > 0
  const premiumActive = Boolean(listing.featured)
  // Premium placement can be bought for an active listing only (enable_premium_placement).
  const premiumUnavailable = !premiumActive && listing.status !== 'available'
  const hasChat = threads.some((t) => t.listingId === listing.id)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTriedSubmit(true)
    setError(null)
    if (photos.busy) { toast.error('Wait for the photos to finish uploading'); return }
    if (form.missing.length > 0) { toast.error('Please complete all required fields'); return }

    setSaving(true)
    const input = form.toInput()
    try {
      await updateListing(listing.id, input)
      // Photos taken off the listing: remove them from storage now that it's saved.
      deleteStoredPhotos(listing.images.filter((url) => !input.images.includes(url)))
      try {
        const { change } = await syncPremiumPlacement(listing, premium, premiumMethod)
        if (change) void refresh()
        toast.success('Listing updated', {
          description: change === 'enabled'
            ? `Premium placement is on for ${PREMIUM_PLACEMENT_DAYS} days. Paid ${formatPrice(PREMIUM_PLACEMENT_FEE)} (simulated).`
            : change === 'ended' ? 'Premium placement ended. No refund.' : input.title,
        })
      } catch (err) {
        toast.warning('Changes saved, but premium placement was not changed', {
          description: `${err instanceof Error ? err.message : String(err)} Nothing was charged.`,
        })
      }
      router.push('/my-listings')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Could not save your changes', { description: message })
      setSaving(false)
    }
  }

  const onToggleStatus = async () => {
    const next = listing.status === 'paused' ? 'available' : 'paused'
    setBusyStatus(true)
    setError(null)
    try {
      await updateListingStatus(listing.id, next)
      toast.success(next === 'paused' ? 'Listing paused' : 'Listing is active again', { description: listing.title })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Could not change the status', { description: message })
    } finally {
      setBusyStatus(false)
    }
  }

  const onDelete = async () => {
    setBusyStatus(true)
    setError(null)
    try {
      await deleteListing(listing.id)
      deleteStoredPhotos(listing.images)
      photos.discardFresh()
      toast('Listing deleted', { description: listing.title })
      router.push('/my-listings')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Could not delete the listing', { description: message })
      setBusyStatus(false)
    } finally {
      setConfirmDelete(false)
    }
  }

  const onCancel = () => {
    photos.discardFresh()
    router.push('/my-listings')
  }

  return (
    <div className="space-y-10">
      <div className="mb-12">
        <Link href="/my-listings" className="mb-4 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> My listings
        </Link>
        <p className="label-tag mb-2">My account</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Edit Listing</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">Make changes to &ldquo;{listing.title}&rdquo;.</p>
      </div>

      {/* Status & lifecycle */}
      <div className="max-w-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-tag">Status</p>
            <p className="mt-1 text-[14px] font-semibold" data-testid="listing-status">{STATUS_LABELS[listing.status]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {listing.type === 'rent' && (
              <Link
                href={`/dashboard/listings/${listing.id}/requests`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <PackageSearch className="mr-1.5 h-3.5 w-3.5" />
                Rental requests{locks && locks.pendingRequests.length > 0 ? ` (${locks.pendingRequests.length})` : ''}
              </Link>
            )}
            {canToggle && (
              <Button type="button" variant="outline" size="sm" onClick={onToggleStatus} disabled={busyStatus}>
                {listing.status === 'paused'
                  ? <><Play className="mr-1.5 h-3.5 w-3.5" /> Make active</>
                  : <><Pause className="mr-1.5 h-3.5 w-3.5" /> Pause</>}
              </Button>
            )}
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busyStatus || hasHistory}
              title={hasHistory ? historyMessage(listing.status) : undefined}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
        {(openDeal || hasHistory) && (
          <div className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {openDeal && <>{OPEN_DEAL_MESSAGE} </>}
              {hasHistory && historyMessage(listing.status)}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-7" noValidate>

        {/* Sale vs Rent */}
        <div>
          <p className="label-tag mb-3">Listing type</p>
          <div className="flex gap-6 border-b border-border pb-4">
            {[
              { value: 'sale' as ListingType, title: 'For sale', sub: 'Free in person.' },
              { value: 'rent' as ListingType, title: 'For rent', sub: 'Deposit in escrow.' },
            ].map(({ value, title: t, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => form.onTypeChange(value)}
                disabled={typeLocked}
                aria-pressed={type === value}
                className={cn(
                  'flex items-center gap-2 transition-all duration-150 disabled:cursor-not-allowed',
                  type === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                )}
              >
                <div className={cn(
                  'h-4 w-4 rounded-full border flex items-center justify-center',
                  type === value ? 'border-primary' : 'border-input'
                )}>
                  {type === value && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold tracking-wide uppercase">{t}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </button>
            ))}
          </div>
          {(hasHistory || openDeal) ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              The type is fixed once the item has been rented or sold through {BRAND}.
            </p>
          ) : pendingCount > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">{PENDING_TYPE_MESSAGE}</p>
          )}
        </div>

        {/* Basic Details */}
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Listing title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => form.setTitle(e.target.value)}
                placeholder="What are you listing?"
                className="font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select items={CATEGORY_ITEMS} value={category} onValueChange={(v) => form.onCategoryChange(v as CategoryId)}>
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select items={CONDITION_ITEMS} value={condition} onValueChange={(v) => form.setCondition(v as Condition)}>
                <SelectTrigger aria-label="Condition">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => form.setDescription(e.target.value)}
              placeholder="Any flaws, history, or reasons for passing it on?"
              className="min-h-[100px] text-[13px] leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-1.5">
          <Label htmlFor="listing-photos">Photos (max {MAX_LISTING_PHOTOS})</Label>
          <PhotoUploader photos={photos} />
        </div>

        {/* Pricing */}
        <div className="border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-muted text-primary">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold">Pricing</p>
              <p className="text-[11px] text-muted-foreground">Set your {type === 'sale' ? 'selling' : 'rental'} terms</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">{type === 'sale' ? 'Price' : 'Rental Price'}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-display font-semibold text-muted-foreground">฿</span>
                <Input
                  id="price"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={price}
                  onChange={(e) => form.setPrice(e.target.value)}
                  placeholder="0"
                  className="pl-8 font-medium"
                />
              </div>
            </div>

            {type === 'rent' && (
              <div className="space-y-1.5">
                <Label>Rental Period</Label>
                <Select items={PERIOD_ITEMS} value={rentalPeriod} onValueChange={(v) => form.setRentalPeriod(v ?? 'per semester')}>
                  <SelectTrigger aria-label="Rental period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per semester">Per Semester (4 months)</SelectItem>
                    <SelectItem value="per month">Per Month</SelectItem>
                    <SelectItem value="per week">Per Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === 'rent' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="deposit">Security Deposit (Refundable)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-display font-semibold text-muted-foreground">฿</span>
                  <Input
                    id="deposit"
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={valueRange?.min ?? DEPOSIT_MIN}
                    max={valueRange?.max ?? DEPOSIT_MAX}
                    value={deposit}
                    onChange={(e) => form.onDepositChange(e.target.value)}
                    placeholder={String(suggestion)}
                    aria-invalid={depositError ? true : undefined}
                    aria-describedby={depositError ? 'deposit-hint deposit-error' : 'deposit-hint'}
                    className="pl-8 font-medium"
                  />
                </div>
                <p id="deposit-hint" className="text-[11px] text-muted-foreground leading-relaxed">
                  {category
                    ? <>Suggested for {categoryLabel(category)}: {formatPrice(suggestedDeposit(category))}.</>
                    : <>Suggested: {formatPrice(suggestedDeposit(undefined))}. Pick a category for a better estimate.</>}
                  {' '}Allowed {formatPrice(valueRange?.min ?? DEPOSIT_MIN)} – {formatPrice(valueRange?.max ?? DEPOSIT_MAX)}.
                  {deposit !== String(suggestion) && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={form.applySuggestion}
                        className="font-semibold text-primary hover:underline underline-offset-2"
                      >
                        Use {formatPrice(suggestion)}
                      </button>
                    </>
                  )}
                </p>
                {depositError && (
                  <p id="deposit-error" role="alert" className="text-[11px] leading-relaxed text-destructive">
                    {depositError}
                  </p>
                )}
                {openDeal && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Bookings already made keep the price and deposit they were quoted.
                  </p>
                )}
              </div>
            )}

            {type === 'rent' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="replacement-value">
                  Item&apos;s Replacement Value <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-display font-semibold text-muted-foreground">฿</span>
                  <Input
                    id="replacement-value"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={replacementValue}
                    onChange={(e) => form.onReplacementValueChange(e.target.value)}
                    placeholder="What it would cost to buy again"
                    aria-describedby="replacement-value-hint"
                    className="pl-8 font-medium"
                  />
                </div>
                <p id="replacement-value-hint" className="text-[11px] text-muted-foreground leading-relaxed">
                  {valueRange
                    ? <>For this value the deposit must be {formatPrice(valueRange.min)} – {formatPrice(valueRange.max)} ({pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value, within {formatPrice(DEPOSIT_MIN)} – {formatPrice(DEPOSIT_MAX)}).</>
                    : <>Helps set a fair deposit: {pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value. Saved with the listing but not shown to renters.</>}
                </p>
              </div>
            )}

            {/* Placeholder only: the admin approval flow is (open) in BusinessRules.md §3. */}
            {type === 'rent' && highValue && (
              <div className="flex items-start gap-2.5 border border-border bg-surface p-4 md:col-span-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Renting out items worth more than {formatPrice(HIGH_VALUE_RENTAL_THRESHOLD)} needs admin
                  approval. Approval isn&apos;t set up in this prototype yet, so you can still save this listing.
                </p>
              </div>
            )}

            {type === 'rent' && (
              <p className="text-[11px] text-muted-foreground leading-relaxed md:col-span-2">
                {BRAND} holds the deposit in escrow, never you, and refunds it after the return. At booking the
                renter pays your price plus a {pct(RENTAL_COMMISSION_RATE)}% commission and an escrow fee of{' '}
                {formatPrice(ESCROW_FEE_MIN)} or {pct(ESCROW_FEE_RATE)}% of the deposit, whichever is higher
                {escrowFee !== null && <> ({formatPrice(escrowFee)} for this deposit)</>}. You receive the full rental price.
              </p>
            )}

            {type === 'sale' && (
              <p className="text-[11px] text-muted-foreground leading-relaxed md:col-span-2">
                Sales paid in person are free. On a sale paid with protection, {BRAND} keeps a{' '}
                {pct(SALE_COMMISSION_RATE)}% commission from your payout
                {Number(price) > 0 && (
                  <> (you receive {formatPrice(computeSaleQuote(Number(price), 'protected').sellerPayout)} of{' '}
                  {formatPrice(Number(price))})</>
                )}.
              </p>
            )}
          </div>
        </div>

        {/* Pickup & Premium */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Pickup Location</Label>
            <Select value={pickup} onValueChange={(v) => form.setPickup(v ?? '')}>
              <SelectTrigger aria-label="Pickup location"><SelectValue placeholder="Where should they pick it up?" /></SelectTrigger>
              <SelectContent>
                {PICKUP_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={cn(
            'flex items-start gap-4 border p-5 transition-all',
            premium ? 'border-primary bg-primary/5' : 'border-border bg-card'
          )}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <label htmlFor="premium-placement" className="block cursor-pointer text-[13px] font-semibold text-amber-700">
                Premium Placement
              </label>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {formatPrice(PREMIUM_PLACEMENT_FEE)} for {PREMIUM_PLACEMENT_DAYS} days at the top of search and
                pre-arrival matching, paid by you.
              </p>
              {premiumUnavailable ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Only an active listing can be promoted.
                </p>
              ) : (
                <PremiumPaymentFields
                  premium={premium}
                  method={premiumMethod}
                  onMethodChange={form.setPremiumMethod}
                  active={premiumActive}
                  activeUntil={listing.featuredUntil}
                  action="save"
                  className="pt-1"
                />
              )}
            </div>
            <div className="pt-2">
              <input
                id="premium-placement"
                type="checkbox"
                checked={premium}
                disabled={premiumUnavailable}
                onChange={(e) => form.setPremium(e.target.checked)}
                aria-label="Premium placement"
                className="h-4 w-4 rounded-sm border-primary text-primary focus:ring-primary disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {triedSubmit && form.missing.length > 0 && (
          <FormError message={`Add ${listMissing(form.missing)} to save.`} />
        )}
        <FormError message={error} />

        <div className="pt-4 flex gap-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || photos.busy}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
              : photos.busy ? 'Uploading photos…'
              : 'Save Changes'}
          </Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>&ldquo;{listing.title}&rdquo;</strong> from the marketplace.
              {pendingCount > 0 && ' Open requests and purchase intents for it are removed too.'}
              {hasChat && ' Conversations about it are deleted with it.'}
              {(pendingCount > 0 || hasChat) && ' The students involved are notified.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={busyStatus}>Delete listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
