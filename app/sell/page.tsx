'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Check, Info, Loader2 } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, PICKUP_LOCATIONS, CONDITION_LABELS, categoryLabel } from '@/lib/data'
import {
  BUYER_PROTECTION_BASE_FEE, BUYER_PROTECTION_RATE,
  DEPOSIT_MAX, DEPOSIT_MIN, DEPOSIT_VALUE_MAX_RATE, DEPOSIT_VALUE_MIN_RATE,
  ESCROW_FEE_MIN, ESCROW_FEE_RATE, HIGH_VALUE_RENTAL_THRESHOLD,
  PREMIUM_PLACEMENT_DAYS, PREMIUM_PLACEMENT_FEE, RENTAL_COMMISSION_RATE, SALE_COMMISSION_RATE,
  computeSaleQuote, suggestedDeposit,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { CategoryId, Condition, ListingType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PhotoUploader, MAX_LISTING_PHOTOS } from '@/components/photo-uploader'
import {
  CATEGORY_ITEMS, CONDITION_ITEMS, FormError, listMissing, pct, useListingForm,
} from '@/components/listing-form'
import { PremiumPaymentFields, syncPremiumPlacement } from '@/components/premium-placement'
import { cn } from '@/lib/utils'

const PERIOD_ITEMS = [{ value: 'per week', label: 'Per week' }, { value: 'per month', label: 'Per month' }, { value: 'per semester', label: 'Per semester' }]

export default function SellPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { addListing, refresh } = useMarketplace()
  const form = useListingForm()
  const {
    type, title, description, category, condition, price, deposit, replacementValue, rentalPeriod, pickup, premium,
    premiumMethod, valueRange, suggestion, depositError, escrowFee, highValue, photos,
  } = form
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triedSubmit, setTriedSubmit] = useState(false)

  // Editing lives in the owner dashboard now; keep old /sell?edit= links working.
  useEffect(() => {
    if (editId) router.replace(`/dashboard/listings/${editId}/edit`)
  }, [editId, router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTriedSubmit(true)
    setError(null)
    if (photos.busy) { toast.error('Wait for the photos to finish uploading'); return }
    if (form.missing.length > 0) { toast.error('Please complete all required fields'); return }

    setSaving(true)
    try {
      const listing = await addListing(form.toInput())
      if (premium) {
        // The ฿49 charge (simulated) runs after the listing exists. If it
        // fails, the listing stays published without premium placement.
        try {
          await syncPremiumPlacement(listing, true, premiumMethod)
          void refresh()
          toast.success('Your listing is live!', {
            description: `Premium placement is on for ${PREMIUM_PLACEMENT_DAYS} days. Paid ${formatPrice(PREMIUM_PLACEMENT_FEE)} (simulated).`,
          })
        } catch (err) {
          toast.warning('Your listing is live, without premium placement', {
            description: `${err instanceof Error ? err.message : String(err)} Nothing was charged. You can turn it on from Edit.`,
          })
        }
      } else {
        toast.success('Your listing is live!', { description: 'Students can now find and message you.' })
      }
      router.push('/my-listings')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Could not publish the listing', { description: message })
      setSaving(false)
    }
  }

  const onCancel = () => {
    photos.discardFresh()
    router.push('/browse')
  }

  if (editId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[13px] text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening the editor…
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 lg:py-24 min-h-screen">
      {/* Header */}
      <div className="mb-16">
        <p className="label-tag mb-2">PassItOn marketplace</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">List an Item</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Selling before you fly home, or renting out for the semester? Post it for the AIT community.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-7" noValidate>

        {/* Sale vs Rent — two option cards */}
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
                aria-pressed={type === value}
                className={cn(
                  'flex items-center gap-2 transition-all duration-150',
                  type === value
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                <div className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  type === value ? 'border-primary border-[5px]' : 'border-border',
                )} />
                <div className="text-left">
                  <span className="block text-[13px] font-semibold leading-none">{t}</span>
                  <span className="block text-[11px] mt-1">{sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <Label htmlFor="listing-photos" className="label-tag">
            Photos <span className="normal-case font-normal text-muted-foreground">(up to {MAX_LISTING_PHOTOS})</span>
          </Label>
          <PhotoUploader photos={photos} tileClassName="h-20 w-20" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title" className="label-tag">Title</Label>
          <Input id="title" value={title} onChange={(e) => form.setTitle(e.target.value)} placeholder="e.g. Sturdy wooden study desk" />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="label-tag">Description</Label>
          <Textarea
            id="description" value={description}
            onChange={(e) => form.setDescription(e.target.value)}
            rows={4} placeholder="Condition, why you're selling, any quirks, what's included." className="resize-none"
          />
        </div>

        {/* Category + Condition */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="label-tag">Category</Label>
            <Select items={CATEGORY_ITEMS} value={category} onValueChange={(v) => form.onCategoryChange(v as CategoryId)}>
              <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-tag">Condition</Label>
            <Select items={CONDITION_ITEMS} value={condition} onValueChange={(v) => form.setCondition(v as Condition)}>
              <SelectTrigger aria-label="Condition"><SelectValue placeholder="Choose condition" /></SelectTrigger>
              <SelectContent>{Object.entries(CONDITION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Price + Rental period or pickup */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="price" className="label-tag">{type === 'rent' ? 'Rental price (฿)' : 'Price (฿)'}</Label>
            <Input id="price" type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => form.setPrice(e.target.value)} placeholder="0" />
          </div>
          {type === 'rent' ? (
            <div className="space-y-1.5">
              <Label className="label-tag">Period</Label>
              <Select items={PERIOD_ITEMS} value={rentalPeriod} onValueChange={(v) => form.setRentalPeriod(v ?? 'per semester')}>
                <SelectTrigger aria-label="Rental period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per week">Per week</SelectItem>
                  <SelectItem value="per month">Per month</SelectItem>
                  <SelectItem value="per semester">Per semester</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="label-tag">Pickup location</Label>
              <Select value={pickup} onValueChange={(v) => form.setPickup(v ?? '')}>
                <SelectTrigger aria-label="Pickup location"><SelectValue placeholder="Where on campus?" /></SelectTrigger>
                <SelectContent>{PICKUP_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Rental-only fields */}
        {type === 'rent' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deposit" className="label-tag">Refundable deposit (฿)</Label>
                <Input
                  id="deposit" type="number" inputMode="numeric" step={1}
                  min={valueRange?.min ?? DEPOSIT_MIN} max={valueRange?.max ?? DEPOSIT_MAX}
                  value={deposit}
                  onChange={(e) => form.onDepositChange(e.target.value)}
                  placeholder={String(suggestion)}
                  aria-invalid={depositError ? true : undefined}
                  aria-describedby={depositError ? 'deposit-hint deposit-error' : 'deposit-hint'}
                />
                <p id="deposit-hint" className="text-[11px] leading-relaxed text-muted-foreground">
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
              </div>
              <div className="space-y-1.5">
                <Label className="label-tag">Pickup location</Label>
                <Select value={pickup} onValueChange={(v) => form.setPickup(v ?? '')}>
                  <SelectTrigger aria-label="Pickup location"><SelectValue placeholder="Where on campus?" /></SelectTrigger>
                  <SelectContent>{PICKUP_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="replacement-value" className="label-tag">
                Item&apos;s replacement value (฿) <span className="normal-case font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="replacement-value" type="number" inputMode="numeric" min={0}
                value={replacementValue}
                onChange={(e) => form.onReplacementValueChange(e.target.value)}
                placeholder="What it would cost to buy again"
                aria-describedby="replacement-value-hint"
              />
              <p id="replacement-value-hint" className="text-[11px] leading-relaxed text-muted-foreground">
                {valueRange
                  ? <>For this value the deposit must be {formatPrice(valueRange.min)} – {formatPrice(valueRange.max)} ({pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value, within {formatPrice(DEPOSIT_MIN)} – {formatPrice(DEPOSIT_MAX)}).</>
                  : <>Helps set a fair deposit: {pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value. Saved with the listing but not shown to renters.</>}
              </p>
            </div>

            {/* Placeholder only: the admin approval flow is (open) in BusinessRules.md §3. */}
            {highValue && (
              <div className="flex items-start gap-2.5 border border-border bg-surface p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Renting out items worth more than {formatPrice(HIGH_VALUE_RENTAL_THRESHOLD)} needs admin
                  approval. Approval isn&apos;t set up in this prototype yet, so your listing will still be published.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Contextual info note */}
        {type === 'rent' ? (
          <div className="flex items-start gap-2.5 border border-amber-200/50 bg-amber-50/50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
            <p className="text-[12px] leading-relaxed text-surge-foreground">
              The renter&apos;s deposit is held in escrow by {BRAND}, never by you, and refunded when you
              confirm the item came back in good condition. At booking, the renter pays your price plus a{' '}
              {pct(RENTAL_COMMISSION_RATE)}% commission and an escrow fee of {formatPrice(ESCROW_FEE_MIN)} or{' '}
              {pct(ESCROW_FEE_RATE)}% of the deposit, whichever is higher
              {escrowFee !== null && <> ({formatPrice(escrowFee)} for this deposit)</>}.
              You receive the full rental price.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 border border-border bg-surface p-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Free to list. Buyers pay you in person (free for both of you), or choose &ldquo;Pay with
              protection&rdquo; for {formatPrice(BUYER_PROTECTION_BASE_FEE)} + {pct(BUYER_PROTECTION_RATE)}%, paid by them. On
              a protected sale, {BRAND} keeps a {pct(SALE_COMMISSION_RATE)}% commission from your payout
              {Number(price) > 0 && (
                <> (you receive {formatPrice(computeSaleQuote(Number(price), 'protected').sellerPayout)} of{' '}
                {formatPrice(Number(price))})</>
              )}.
            </p>
          </div>
        )}

        {/* Premium placement toggle (a simulated ฿49 charge on publish) */}
        <div className="border-t border-border pt-6 space-y-3">
          <button
            type="button"
            role="switch"
            aria-checked={premium}
            onClick={() => form.setPremium((p) => !p)}
            className="group flex w-full items-start gap-3 text-left transition-all duration-150"
          >
            <div className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
              premium ? 'border-primary bg-primary text-primary-foreground' : 'border-border group-hover:border-foreground/40',
            )}>
              {premium && <Check className="h-3 w-3" />}
            </div>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-foreground">
                Premium placement · {formatPrice(PREMIUM_PLACEMENT_FEE)} for {PREMIUM_PLACEMENT_DAYS} days
              </span>
              <span className="block text-[12px] text-muted-foreground mt-0.5">
                Appear first in search and pre-arrival matching. Useful when clearing a whole room.
              </span>
            </span>
          </button>
          <PremiumPaymentFields
            premium={premium}
            method={premiumMethod}
            onMethodChange={form.setPremiumMethod}
            active={false}
            action="publish"
            className="pl-7"
          />
        </div>

        {triedSubmit && form.missing.length > 0 && (
          <FormError message={`Add ${listMissing(form.missing)} to publish.`} />
        )}
        <FormError message={error} />

        {/* Submit */}
        <div className="flex gap-3 pt-1">
          <Button type="submit" size="lg" disabled={saving || photos.busy} className="flex-1">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…</>
              : photos.busy ? 'Uploading photos…'
              : 'Publish listing'}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
