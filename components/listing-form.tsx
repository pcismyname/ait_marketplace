'use client'

// Shared state and rules for the sell form (/sell) and the edit form
// (/dashboard/listings/[id]/edit). Deposit rules follow BusinessRules.md §3
// through lib/fees.ts: category suggestion, ฿200–฿3,000, and 30–50% of the
// replacement value when the owner gives one (persisted in
// listings.replacement_value). Amounts are whole baht. Premium placement (§2)
// is a simulated ฿49 charge for 7 days through enable_premium_placement
// (lib/api/listing-owner.ts), never a direct write of featured / featured_until.

import { useCallback, useState } from 'react'
import { Info } from 'lucide-react'
import {
  depositRangeForValue, escrowHandlingFee, needsRentalApproval, suggestedDeposit,
  validateDeposit,
} from '@/lib/fees'
import type { useMarketplace } from '@/lib/store'
import { CATEGORIES, CONDITION_LABELS } from '@/lib/data'
import type { CategoryId, Condition, Listing, ListingType, PaymentMethod } from '@/lib/types'
import { usePhotoUploads } from '@/components/photo-uploader'

export type ListingInput = Parameters<ReturnType<typeof useMarketplace>['addListing']>[0]

/** Select items, so the closed select shows the label rather than the stored value. */
export const CATEGORY_ITEMS = CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
export const CONDITION_ITEMS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))

/** A rate such as 0.03 as a whole percentage (3). */
export const pct = (rate: number) => Math.round(rate * 100)

const toValue = (raw: string) => (Number(raw) > 0 ? Number(raw) : undefined)

export function useListingForm() {
  const [type, setType] = useState<ListingType>('sale')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [condition, setCondition] = useState<Condition | ''>('')
  const [price, setPrice] = useState('')
  const [deposit, setDepositRaw] = useState('')
  // False while the deposit still holds the platform's suggestion; it then
  // follows category / value changes. Typing a deposit sets it to true.
  const [depositTouched, setDepositTouched] = useState(false)
  const [replacementValue, setReplacementValue] = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('per semester')
  const [pickup, setPickup] = useState('')
  const [premium, setPremium] = useState(false)
  const [premiumMethod, setPremiumMethod] = useState<PaymentMethod>('promptpay')
  const photos = usePhotoUploads()
  const resetPhotos = photos.reset

  // ─── Deposit rules (BusinessRules.md §3) ──────────────────────────────────
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
    if (!depositTouched) setDepositRaw(String(suggestionFor(cat, amount)))
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
  const onDepositChange = (raw: string) => {
    setDepositRaw(raw)
    setDepositTouched(true)
  }
  const applySuggestion = () => {
    setDepositRaw(String(suggestion))
    setDepositTouched(false)
  }

  const depositAmount = deposit.trim() === '' ? undefined : Number(deposit)
  const depositError = type !== 'rent' ? null
    : depositAmount !== undefined && Number.isFinite(depositAmount) && !Number.isInteger(depositAmount)
      ? 'The deposit must be a whole number of baht.'
      : validateDeposit(depositAmount, itemValue)
  const escrowFee = type === 'rent' && !depositError && depositAmount ? escrowHandlingFee(depositAmount) : null
  const highValue = needsRentalApproval(itemValue)

  /** Fill the form from a saved listing. */
  const loadFrom = useCallback((listing: Listing) => {
    setType(listing.type)
    setTitle(listing.title)
    setDescription(listing.description)
    setCategory(listing.category)
    setCondition(listing.condition)
    setPrice(listing.price.toString())
    // Legacy rentals without a deposit start from the category suggestion.
    setDepositRaw(
      listing.deposit ? listing.deposit.toString()
        : listing.type === 'rent' ? String(suggestedDeposit(listing.category))
        : '',
    )
    setDepositTouched(Boolean(listing.deposit))
    setReplacementValue(listing.replacementValue ? String(listing.replacementValue) : '')
    setRentalPeriod(listing.rentalPeriod || 'per semester')
    setPickup(listing.pickupLocation ?? '')
    setPremium(Boolean(listing.featured))
    resetPhotos(listing.images)
  }, [resetPhotos])

  const missing: string[] = []
  if (!title.trim()) missing.push('a title')
  if (!description.trim()) missing.push('a description')
  if (!category) missing.push('a category')
  if (!condition) missing.push('the condition')
  if (!(Number(price) > 0)) missing.push('a price above ฿0')
  else if (!Number.isInteger(Number(price))) missing.push('a price in whole baht')
  if (!pickup) missing.push('a pickup location')
  if (type === 'rent' && depositError) missing.push('a valid deposit')

  const valid = missing.length === 0 && !photos.busy

  /**
   * The values to save. Premium placement isn't part of it: the pages call
   * enablePremiumPlacement / endPremiumPlacement after saving.
   */
  const toInput = (): ListingInput => {
    const isRent = type === 'rent'
    return {
      title: title.trim(),
      description: description.trim(),
      category: category as CategoryId,
      type,
      price: Number(price),
      deposit: isRent ? Number(deposit) : undefined,
      rentalPeriod: isRent ? rentalPeriod : undefined,
      replacementValue: isRent ? (itemValue ?? null) : null,
      condition: condition as Condition,
      images: photos.urls.length > 0 ? photos.urls : ['/placeholder.svg'],
      pickupLocation: pickup,
    }
  }

  return {
    type, title, description, category, condition, price, deposit, replacementValue, rentalPeriod, pickup, premium,
    premiumMethod,
    setTitle, setDescription, setCondition, setPrice, setRentalPeriod, setPickup, setPremium, setPremiumMethod,
    onTypeChange, onCategoryChange, onReplacementValueChange, onDepositChange, applySuggestion,
    itemValue, valueRange, suggestion, depositError, escrowFee, highValue,
    photos, loadFrom, missing, valid, toInput,
  }
}

export type ListingFormState = ReturnType<typeof useListingForm>

/** Inline error box used by the listing forms and the owner dashboard. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2.5 border border-destructive/30 bg-destructive/5 p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-[12px] leading-relaxed text-destructive">{message}</p>
    </div>
  )
}

/** "a title, a price and a pickup location" */
export function listMissing(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
