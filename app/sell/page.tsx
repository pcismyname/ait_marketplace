'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImagePlus, X, Tag, HandCoins, ShieldCheck, Sparkles, Check } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, PICKUP_LOCATIONS, CONDITION_LABELS } from '@/lib/data'
import {
  ESCROW_HANDLING_FEE,
  PREMIUM_PLACEMENT_FEE,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { CategoryId, Condition, ListingType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function SellPage() {
  const router = useRouter()
  const { addListing } = useMarketplace()
  const fileRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<ListingType>('sale')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [condition, setCondition] = useState<Condition | ''>('')
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('per semester')
  const [pickup, setPickup] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [premium, setPremium] = useState(false)

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const urls = Array.from(files).map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...urls].slice(0, 5))
  }

  const removeImage = (url: string) =>
    setImages((prev) => prev.filter((u) => u !== url))

  const valid =
    title.trim() &&
    description.trim() &&
    category &&
    condition &&
    Number(price) > 0 &&
    pickup &&
    (type === 'sale' || Number(deposit) >= 0)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) {
      toast.error('Please complete all required fields')
      return
    }
    const listing = addListing({
      title: title.trim(),
      description: description.trim(),
      category: category as CategoryId,
      type,
      price: Number(price),
      deposit: type === 'rent' ? Number(deposit) : undefined,
      rentalPeriod: type === 'rent' ? rentalPeriod : undefined,
      condition: condition as Condition,
      images: images.length ? images : ['/placeholder.svg'],
      pickupLocation: pickup,
      featured: premium,
    })
    toast.success('Your listing is live!', {
      description: premium
        ? `Premium placement active for 7 days (${formatPrice(PREMIUM_PLACEMENT_FEE)}, simulated).`
        : 'Incoming students can now find and message you.',
    })
    router.push(`/listing/${listing.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          List an item
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selling before you fly home, or renting out for the semester? Post it for the
          AIT community.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Sale vs Rent */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType('sale')}
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
              type === 'sale'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <Tag
              className={cn(
                'mt-0.5 h-5 w-5',
                type === 'sale' ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span>
              <span className="block text-sm font-semibold">For sale</span>
              <span className="block text-xs text-muted-foreground">
                One-time sale, buyer keeps it. Free.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setType('rent')}
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
              type === 'rent'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <HandCoins
              className={cn(
                'mt-0.5 h-5 w-5',
                type === 'rent' ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span>
              <span className="block text-sm font-semibold">For rent</span>
              <span className="block text-xs text-muted-foreground">
                Returned with deposit escrow
              </span>
            </span>
          </button>
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <Label>Photos</Label>
          <div className="flex flex-wrap gap-3">
            {images.map((url) => (
              <div
                key={url}
                className="relative h-24 w-24 overflow-hidden rounded-xl border border-border"
              >
                <Image src={url} alt="Upload preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground"
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
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Add photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sturdy wooden study desk"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Condition, why you're selling, any quirks, and what's included."
            className="resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose condition" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price">
              {type === 'rent' ? 'Rental price (฿)' : 'Price (฿)'}
            </Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          {type === 'rent' ? (
            <div className="space-y-2">
              <Label>Rental period</Label>
              <Select value={rentalPeriod} onValueChange={(v) => setRentalPeriod(v ?? 'per semester')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per week">per week</SelectItem>
                  <SelectItem value="per month">per month</SelectItem>
                  <SelectItem value="per semester">per semester</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Pickup location</Label>
              <Select value={pickup} onValueChange={(v) => setPickup(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Where on campus?" />
                </SelectTrigger>
                <SelectContent>
                  {PICKUP_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {type === 'rent' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deposit">Refundable deposit (฿)</Label>
              <Input
                id="deposit"
                type="number"
                min={0}
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Pickup location</Label>
              <Select value={pickup} onValueChange={(v) => setPickup(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Where on campus?" />
                </SelectTrigger>
                <SelectContent>
                  {PICKUP_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {type === 'rent' ? (
          <div className="flex items-start gap-2 rounded-2xl bg-surge-muted p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
            <p className="text-xs text-surge-foreground">
              The renter&apos;s deposit is held in escrow by {BRAND} and released back to
              them once you confirm the item was returned in good condition. If there&apos;s
              damage, you can open a dispute before releasing. At booking the renter pays
              your rental price plus a {Math.round(RENTAL_COMMISSION_RATE * 100)}% platform
              commission and a {formatPrice(ESCROW_HANDLING_FEE)} escrow handling fee. You
              receive the full rental price.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl bg-secondary/60 p-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-secondary-foreground">
              Free to list, free to sell. Peer-to-peer sales carry no platform fee, so{' '}
              {BRAND} stays as frictionless as the group chat it replaces. Fees only apply
              when the platform holds a deposit for you.
            </p>
          </div>
        )}

        {/* Premium placement (optional, simulated) */}
        <button
          type="button"
          role="switch"
          aria-checked={premium}
          onClick={() => setPremium((p) => !p)}
          className={cn(
            'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
            premium
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:border-primary/40',
          )}
        >
          <Sparkles
            className={cn('mt-0.5 h-5 w-5', premium ? 'text-primary' : 'text-muted-foreground')}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Premium placement · {formatPrice(PREMIUM_PLACEMENT_FEE)} for 7 days
            </span>
            <span className="block text-xs text-muted-foreground">
              Show this listing first in search results and pre-arrival matching. Handy if
              you are clearing out a whole room before a flight.
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              premium ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
            )}
          >
            {premium && <Check className="h-3 w-3" />}
          </span>
        </button>

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={!valid} className="flex-1">
            Publish listing
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => router.push('/browse')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
