'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImagePlus, X, Tag, HandCoins, ShieldCheck, Sparkles, Check } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, PICKUP_LOCATIONS, CONDITION_LABELS } from '@/lib/data'
import { ESCROW_HANDLING_FEE, PREMIUM_PLACEMENT_FEE, RENTAL_COMMISSION_RATE } from '@/lib/fees'
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

export default function SellPage() {
  const router = useRouter()
  const { addListing } = useMarketplace()
  const fileRef = useRef<HTMLInputElement>(null)

  const [type, setType]               = useState<ListingType>('sale')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<CategoryId | ''>('')
  const [condition, setCondition]     = useState<Condition | ''>('')
  const [price, setPrice]             = useState('')
  const [deposit, setDeposit]         = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('per semester')
  const [pickup, setPickup]           = useState('')
  const [images, setImages]           = useState<string[]>([])
  const [premium, setPremium]         = useState(false)

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const urls = Array.from(files).map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...urls].slice(0, 5))
  }

  const valid =
    title.trim() && description.trim() && category && condition &&
    Number(price) > 0 && pickup && (type === 'sale' || Number(deposit) >= 0)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) { toast.error('Please complete all required fields'); return }
    const listing = addListing({
      title: title.trim(), description: description.trim(),
      category: category as CategoryId, type,
      price: Number(price),
      deposit: type === 'rent' ? Number(deposit) : undefined,
      rentalPeriod: type === 'rent' ? rentalPeriod : undefined,
      condition: condition as Condition,
      images: images.length ? images : ['/placeholder.svg'],
      pickupLocation: pickup, featured: premium,
    })
    toast.success('Your listing is live!', {
      description: premium
        ? `Premium placement active for 7 days (${formatPrice(PREMIUM_PLACEMENT_FEE)}, simulated).`
        : 'Students can now find and message you.',
    })
    router.push('/my-listings')
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 lg:py-24 min-h-screen">
      {/* Header */}
      <div className="mb-16">
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">List an Item</h1>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          Selling before you fly home, or renting out for the semester?
          Post it for the AIT community.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-7">

        {/* Sale vs Rent — two option cards */}
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
                onClick={() => setType(value)}
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
          <Label className="label-tag">Photos <span className="normal-case font-normal text-muted-foreground">(up to 5)</span></Label>
          <div className="flex flex-wrap gap-2.5">
            {images.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden border border-border bg-surface-tinted">
                <Image src={url} alt="Upload preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-surface-tinted hover:text-foreground"
              >
                <ImagePlus className="h-4 w-4" />
                <span className="text-[11px]">Add photo</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title" className="label-tag">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sturdy wooden study desk" />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="label-tag">Description</Label>
          <Textarea
            id="description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4} placeholder="Condition, why you're selling, any quirks, what's included." className="resize-none"
          />
        </div>

        {/* Category + Condition */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="label-tag">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
              <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-tag">Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
              <SelectTrigger><SelectValue placeholder="Choose condition" /></SelectTrigger>
              <SelectContent>{Object.entries(CONDITION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Price + Rental period or pickup */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="price" className="label-tag">{type === 'rent' ? 'Rental price (฿)' : 'Price (฿)'}</Label>
            <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
          {type === 'rent' ? (
            <div className="space-y-1.5">
              <Label className="label-tag">Period</Label>
              <Select value={rentalPeriod} onValueChange={(v) => setRentalPeriod(v ?? 'per semester')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={pickup} onValueChange={(v) => setPickup(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Where on campus?" /></SelectTrigger>
                <SelectContent>{PICKUP_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Rental-only fields */}
        {type === 'rent' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deposit" className="label-tag">Refundable deposit (฿)</Label>
              <Input id="deposit" type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="label-tag">Pickup location</Label>
              <Select value={pickup} onValueChange={(v) => setPickup(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Where on campus?" /></SelectTrigger>
                <SelectContent>{PICKUP_LOCATIONS.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Contextual info note */}
        {type === 'rent' ? (
          <div className="flex items-start gap-2.5 border border-amber-200/50 bg-amber-50/50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
            <p className="text-[12px] leading-relaxed text-surge-foreground">
              The renter&apos;s deposit is held in escrow by {BRAND} and released when you confirm
              the item came back in good condition. At booking, the renter pays your price plus a{' '}
              {Math.round(RENTAL_COMMISSION_RATE * 100)}% commission and a{' '}
              {formatPrice(ESCROW_HANDLING_FEE)} escrow fee. You receive the full rental price.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 border border-border bg-surface p-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Free to list, free to sell. No platform fee on peer-to-peer sales.
            </p>
          </div>
        )}

        {/* Premium placement toggle */}
        <div className="border-t border-border pt-6">
          <button
            type="button"
            role="switch"
            aria-checked={premium}
            onClick={() => setPremium((p) => !p)}
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
                Premium placement · {formatPrice(PREMIUM_PLACEMENT_FEE)} for 7 days
              </span>
              <span className="block text-[12px] text-muted-foreground mt-0.5">
                Appear first in search and pre-arrival matching. Useful when clearing a whole room.
              </span>
            </span>
          </button>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-1">
          <Button type="submit" size="lg" disabled={!valid} className="flex-1">
            Publish listing
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.push('/browse')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
