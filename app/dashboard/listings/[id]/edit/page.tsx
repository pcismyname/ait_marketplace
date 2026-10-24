'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImagePlus, X, Tag, Sparkles, Info } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, PICKUP_LOCATIONS, CONDITION_LABELS, categoryLabel } from '@/lib/data'
import {
  DEPOSIT_MAX, DEPOSIT_MIN, DEPOSIT_VALUE_MAX_RATE, DEPOSIT_VALUE_MIN_RATE,
  ESCROW_FEE_MIN, ESCROW_FEE_RATE, HIGH_VALUE_RENTAL_THRESHOLD,
  PREMIUM_PLACEMENT_DAYS, PREMIUM_PLACEMENT_FEE, RENTAL_COMMISSION_RATE,
  depositRangeForValue, escrowHandlingFee, needsRentalApproval, suggestedDeposit, validateDeposit,
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
import { cn } from '@/lib/utils'

/** A rate such as 0.03 as a whole percentage (3). */
const pct = (rate: number) => Math.round(rate * 100)

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings, updateListingStatus } = useMarketplace()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  
  // Form State
  const [type, setType]               = useState<ListingType>('sale')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<CategoryId | ''>('')
  const [condition, setCondition]     = useState<Condition | ''>('')
  const [price, setPrice]             = useState('')
  const [deposit, setDeposit]         = useState('')
  // False while the deposit still holds the platform's suggestion; it then
  // follows category / value changes. Typing a deposit sets it to true.
  const [depositTouched, setDepositTouched] = useState(false)
  // Helper field only, never saved: listings have no replacement-value column.
  // It narrows the allowed deposit to 30–50% of the value (BusinessRules.md §3).
  const [replacementValue, setReplacementValue] = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('per semester')
  const [pickup, setPickup]           = useState('')
  const [images, setImages]           = useState<string[]>([])
  const [premium, setPremium]         = useState(false)

  // ─── Deposit rules (BusinessRules.md §3) ──────────────────────────────────
  const toValue = (raw: string) => (Number(raw) > 0 ? Number(raw) : undefined)
  const itemValue = toValue(replacementValue)
  const valueRange = itemValue !== undefined ? depositRangeForValue(itemValue) : null

  /** Category suggestion, kept inside the value range when a value is given. */
  const suggestionFor = (cat: CategoryId | '', amount: number | undefined) => {
    const base = suggestedDeposit(cat || undefined)
    if (amount === undefined) return base
    const { min, max } = depositRangeForValue(amount)
    return Math.min(max, Math.max(min, base))
  }
  const suggestion = suggestionFor(category, itemValue)

  const prefillDeposit = (cat: CategoryId | '', amount: number | undefined) => {
    if (!depositTouched) setDeposit(String(suggestionFor(cat, amount)))
  }

  const onTypeChange = (next: ListingType) => {
    setType(next)
    if (next === 'rent') prefillDeposit(category, itemValue)
  }
  const onCategoryChange = (next: CategoryId) => {
    setCategory(next)
    if (type === 'rent') prefillDeposit(next, itemValue)
  }
  const onReplacementValueChange = (raw: string) => {
    setReplacementValue(raw)
    if (type === 'rent') prefillDeposit(category, toValue(raw))
  }

  const depositAmount = deposit.trim() === '' ? undefined : Number(deposit)
  const depositError = type === 'rent' ? validateDeposit(depositAmount, itemValue) : null
  const escrowFee = type === 'rent' && !depositError && depositAmount ? escrowHandlingFee(depositAmount) : null
  const highValue = needsRentalApproval(itemValue)

  useEffect(() => {
    const listing = listings.find(l => l.id === id)
    if (listing) {
      setType(listing.type)
      setTitle(listing.title)
      setDescription(listing.description)
      setCategory(listing.category)
      setCondition(listing.condition)
      setPrice(listing.price.toString())
      // Legacy rentals without a deposit start from the category suggestion.
      setDeposit(
        listing.deposit ? listing.deposit.toString()
          : listing.type === 'rent' ? String(suggestedDeposit(listing.category))
          : '',
      )
      setDepositTouched(Boolean(listing.deposit))
      setRentalPeriod(listing.rentalPeriod || 'per semester')
      setPickup(listing.pickupLocation)
      setImages(listing.images.filter(img => img !== '/placeholder.svg'))
      setPremium(listing.featured || false)
    }
    setLoading(false)
  }, [id, listings])

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const urls = Array.from(files).map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...urls].slice(0, 5))
  }

  const valid =
    title.trim() && description.trim() && category && condition &&
    Number(price) > 0 && pickup && (type === 'sale' || depositError === null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) { toast.error('Please complete all required fields'); return }
    
    // In a real app we'd dispatch an updateListing action. 
    // For this mock, we just show a toast and redirect.
    toast.success('Listing updated successfully!')
    router.push('/my-listings')
  }

  if (loading) return null

  return (
    <div className="space-y-10">
      <div className="mb-12">
        <p className="label-tag mb-2">My account</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Edit Listing</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">Make changes to &ldquo;{title || id}&rdquo;.</p>
      </div>

      <form onSubmit={onSubmit} className="max-w-2xl space-y-7">

        {/* Sale vs Rent */}
        <div>
          <p className="label-tag mb-3">Listing type</p>
          <div className="flex gap-6 border-b border-border pb-4">
            {[
              { value: 'sale' as ListingType, title: 'For sale', sub: 'No platform fee.' },
              { value: 'rent' as ListingType, title: 'For rent', sub: 'Deposit in escrow.' },
            ].map(({ value, title: t, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => onTypeChange(value)}
                className={cn(
                  'flex items-center gap-2 transition-all duration-150',
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
        </div>

        {/* Basic Details */}
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Listing title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you listing?"
                className="font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => onCategoryChange(v as CategoryId)}>
                <SelectTrigger>
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
              <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
                <SelectTrigger>
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
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any flaws, history, or reasons for passing it on?"
              className="min-h-[100px] text-[13px] leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-1.5">
          <Label>Photos (max 5)</Label>
          <div className="flex flex-wrap gap-3">
            {images.map((src, i) => (
              <div key={i} className="relative h-24 w-24 border border-border bg-surface-tinted overflow-hidden">
                <Image src={src} alt="Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground backdrop-blur-sm hover:bg-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center border border-dashed border-border bg-card text-muted-foreground hover:bg-muted/50 transition-colors">
                <ImagePlus className="h-6 w-6" />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider">Add</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </label>
            )}
          </div>
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
              <Label>{type === 'sale' ? 'Price' : 'Rental Price'}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-display font-semibold text-muted-foreground">฿</span>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="pl-8 font-medium"
                />
              </div>
            </div>

            {type === 'rent' && (
              <div className="space-y-1.5">
                <Label>Rental Period</Label>
                <Select value={rentalPeriod} onValueChange={(v) => setRentalPeriod(v ?? 'per semester')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    onChange={(e) => { setDeposit(e.target.value); setDepositTouched(true) }}
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
                        onClick={() => { setDeposit(String(suggestion)); setDepositTouched(false) }}
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
                    onChange={(e) => onReplacementValueChange(e.target.value)}
                    placeholder="What it would cost to buy again"
                    aria-describedby="replacement-value-hint"
                    className="pl-8 font-medium"
                  />
                </div>
                <p id="replacement-value-hint" className="text-[11px] text-muted-foreground leading-relaxed">
                  {valueRange
                    ? <>For this value the deposit must be {formatPrice(valueRange.min)} – {formatPrice(valueRange.max)} ({pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value, within {formatPrice(DEPOSIT_MIN)} – {formatPrice(DEPOSIT_MAX)}).</>
                    : <>Helps set a fair deposit: {pct(DEPOSIT_VALUE_MIN_RATE)}–{pct(DEPOSIT_VALUE_MAX_RATE)}% of the value. Not shown on the listing.</>}
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
          </div>
        </div>

        {/* Pickup & Premium */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Pickup Location</Label>
            <Select value={pickup} onValueChange={(v) => setPickup(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Where should they pick it up?" /></SelectTrigger>
              <SelectContent>
                {PICKUP_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className={cn(
            'flex cursor-pointer items-start gap-4 border p-5 transition-all',
            premium ? 'border-primary bg-primary/5' : 'border-border bg-card'
          )}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[13px] font-semibold text-amber-700">Premium Placement</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {formatPrice(PREMIUM_PLACEMENT_FEE)} for {PREMIUM_PLACEMENT_DAYS} days at the top of search and
                pre-arrival matching. Paid by you when enabled (simulated).
              </p>
            </div>
            <div className="pt-2">
              <input
                type="checkbox"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="h-4 w-4 rounded-sm border-primary text-primary focus:ring-primary"
              />
            </div>
          </label>
        </div>

        <div className="pt-4 flex gap-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.push('/my-listings')}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={!valid}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
