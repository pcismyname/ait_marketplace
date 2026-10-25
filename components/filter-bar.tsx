'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { CATEGORIES, CONDITION_LABELS, PICKUP_LOCATIONS } from '@/lib/data'
import type { ListingSort } from '@/lib/api'
import type { CategoryId, Condition, ListingType } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

export type SortKey = 'recent' | 'price-asc' | 'price-desc'

export interface FilterState {
  q: string
  type: ListingType | 'all'
  category: CategoryId | 'all'
  condition: Condition | 'all'
  location: string
  minPrice?: number
  maxPrice?: number
  sort: SortKey
  sellerId?: string
  favorites?: boolean
}

export const DEFAULT_FILTERS: FilterState = {
  q: '',
  type: 'all',
  category: 'all',
  condition: 'all',
  location: '',
  sort: 'recent',
}

// ─── URL query params are the source of truth (shareable links) ─────────────
//   q, type, category, condition, location, min, max, sort, seller, favorites=1

const SORT_PARAM: Record<SortKey, string> = { recent: 'newest', 'price-asc': 'price-asc', 'price-desc': 'price-desc' }
const isCategory = (v: string | null): v is CategoryId => CATEGORIES.some((c) => c.id === v)
const isCondition = (v: string | null): v is Condition => v !== null && v in CONDITION_LABELS
const toPrice = (v: string | null) => {
  if (v === null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

export function filtersFromParams(params: URLSearchParams): FilterState {
  const type = params.get('type')
  const category = params.get('category')
  const condition = params.get('condition')
  const sort = params.get('sort')
  return {
    q: params.get('q') ?? '',
    type: type === 'sale' || type === 'rent' ? type : 'all',
    category: isCategory(category) ? category : 'all',
    condition: isCondition(condition) ? condition : 'all',
    location: params.get('location') ?? '',
    minPrice: toPrice(params.get('min')),
    maxPrice: toPrice(params.get('max')),
    sort: sort === 'price-asc' || sort === 'price-desc' ? sort : 'recent',
    sellerId: params.get('seller') ?? undefined,
    favorites: params.get('favorites') === '1',
  }
}

/** Apply a change to the current params; untouched params (e.g. unknown ones) are kept. */
export function paramsWithFilters(current: URLSearchParams, change: Partial<FilterState>): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  const set = (key: string, value: string | undefined) => {
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, value)
  }
  if ('q' in change) set('q', change.q?.trim() || undefined)
  if ('type' in change) set('type', change.type === 'all' ? undefined : change.type)
  if ('category' in change) set('category', change.category === 'all' ? undefined : change.category)
  if ('condition' in change) set('condition', change.condition === 'all' ? undefined : change.condition)
  if ('location' in change) set('location', change.location || undefined)
  if ('minPrice' in change) set('min', change.minPrice === undefined ? undefined : String(change.minPrice))
  if ('maxPrice' in change) set('max', change.maxPrice === undefined ? undefined : String(change.maxPrice))
  if ('sort' in change) set('sort', change.sort && change.sort !== 'recent' ? SORT_PARAM[change.sort] : undefined)
  if ('sellerId' in change) set('seller', change.sellerId)
  if ('favorites' in change) set('favorites', change.favorites ? '1' : undefined)
  return next
}

export const toApiSort = (sort: SortKey): ListingSort => (sort === 'recent' ? 'newest' : sort)

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.type !== 'all' || filters.category !== 'all' || filters.condition !== 'all' || filters.location !== '' ||
    filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.q.trim() !== '' ||
    Boolean(filters.sellerId) || Boolean(filters.favorites)
  )
}

function priceLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${formatPrice(min)} – ${formatPrice(max)}`
  if (min !== undefined) return `From ${formatPrice(min)}`
  if (max !== undefined) return `Up to ${formatPrice(max)}`
  return 'Price'
}

interface FilterBarProps {
  filters: FilterState
  /** Total matches in the database; undefined while loading. */
  resultCount: number | undefined
  onChange: (f: Partial<FilterState>) => void
  onReset: () => void
}

// Small dropdown chip. The bar scrolls sideways (overflow-x: auto), which would
// clip an absolute menu, and its backdrop-blur makes it the containing block
// for position: fixed children. So the menu and its click-outside overlay are
// portalled to <body> and placed in viewport coordinates under the chip.
function Chip({
  label,
  active,
  children,
}: {
  label: string
  active: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = () => setAnchor(null)
  const open = anchor !== null
  useEffect(() => {
    if (!open) return
    const onResize = () => setAnchor(null)
    // Scrolling the page moves the chip, so close; scrolling inside the menu doesn't.
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return
      setAnchor(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnchor(null) }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          if (anchor) { close(); return }
          const rect = e.currentTarget.getBoundingClientRect()
          setAnchor({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)) })
        }}
        aria-expanded={anchor !== null}
        className={cn(
          'flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[12px] font-semibold uppercase tracking-wider transition-all',
          active
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border/60 bg-surface text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:shadow-sm',
        )}
      >
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', anchor && 'rotate-180')} />
      </button>
      {anchor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} data-testid="chip-overlay" />
          <div
            ref={menuRef}
            style={{ top: anchor.top, left: anchor.left, maxHeight: `max(160px, calc(100vh - ${anchor.top + 8}px))` }}
            className="fixed z-50 min-w-[160px] overflow-y-auto rounded-sm border border-border bg-background shadow-md"
            data-testid="chip-menu"
          >
            {children(close)}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

function OptionList({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={cn(
            'flex w-full items-center px-4 py-2.5 text-[12px] text-left transition-colors hover:bg-muted',
            value === opt.value ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          {opt.label}
          {value === opt.value && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </>
  )
}

/** Min / max price inputs, applied together. */
function PriceRange({
  min,
  max,
  onApply,
}: {
  min: number | undefined
  max: number | undefined
  onApply: (min: number | undefined, max: number | undefined) => void
}) {
  const [low, setLow] = useState(min === undefined ? '' : String(min))
  const [high, setHigh] = useState(max === undefined ? '' : String(max))
  const lowN = toPrice(low)
  const highN = toPrice(high)
  const invalid = lowN !== undefined && highN !== undefined && lowN > highN
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) onApply(lowN, highN)
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="numeric" min={0} placeholder="Min ฿" value={low}
          onChange={(e) => setLow(e.target.value)} aria-label="Minimum price"
          className="h-9 w-24 rounded-sm border border-border bg-background px-2 text-[12px] outline-none focus:border-foreground/40"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number" inputMode="numeric" min={0} placeholder="Max ฿" value={high}
          onChange={(e) => setHigh(e.target.value)} aria-label="Maximum price"
          className="h-9 w-24 rounded-sm border border-border bg-background px-2 text-[12px] outline-none focus:border-foreground/40"
        />
      </div>
      {invalid && <p className="text-[11px] text-destructive">The minimum is above the maximum.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setLow(''); setHigh(''); onApply(undefined, undefined) }}
          className="flex-1 rounded-sm border border-border py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Any price
        </button>
        <button
          type="submit"
          disabled={invalid}
          className="flex-1 rounded-sm bg-primary py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </form>
  )
}

export function FilterBar({ filters, resultCount, onChange, onReset }: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const active = hasActiveFilters(filters)
  const priceActive = filters.minPrice !== undefined || filters.maxPrice !== undefined
  const countLabel = resultCount === undefined ? '…' : `${resultCount} ${resultCount === 1 ? 'item' : 'items'}`

  return (
    <>
      {/* ── Slim filter bar ── */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="w-full px-4 lg:px-12 xl:px-20 flex h-16 items-center gap-3 overflow-x-auto no-scrollbar">

          <Chip label="Type" active={filters.type !== 'all'}>
            {(close) => (
              <OptionList
                value={filters.type}
                options={[
                  { value: 'all', label: 'Buy & Rent' },
                  { value: 'sale', label: 'For sale' },
                  { value: 'rent', label: 'For rent' },
                ]}
                onSelect={(v) => { onChange({ type: v as FilterState['type'] }); close() }}
              />
            )}
          </Chip>

          <Chip label="Category" active={filters.category !== 'all'}>
            {(close) => (
              <OptionList
                value={filters.category}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
                ]}
                onSelect={(v) => { onChange({ category: v as FilterState['category'] }); close() }}
              />
            )}
          </Chip>

          <Chip label={priceLabel(filters.minPrice, filters.maxPrice)} active={priceActive}>
            {(close) => (
              <PriceRange
                min={filters.minPrice}
                max={filters.maxPrice}
                onApply={(minPrice, maxPrice) => { onChange({ minPrice, maxPrice }); close() }}
              />
            )}
          </Chip>

          <Chip label="Condition" active={filters.condition !== 'all'}>
            {(close) => (
              <OptionList
                value={filters.condition}
                options={[
                  { value: 'all', label: 'Any condition' },
                  ...Object.entries(CONDITION_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
                onSelect={(v) => { onChange({ condition: v as FilterState['condition'] }); close() }}
              />
            )}
          </Chip>

          <Chip label="Location" active={filters.location !== ''}>
            {(close) => (
              <OptionList
                value={filters.location || 'all'}
                options={[
                  { value: 'all', label: 'All locations' },
                  ...PICKUP_LOCATIONS.map((l) => ({ value: l, label: l })),
                ]}
                onSelect={(v) => { onChange({ location: v === 'all' ? '' : v }); close() }}
              />
            )}
          </Chip>

          {/* All filters drawer trigger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground hover:shadow-sm"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            All filters
            {active && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                !
              </span>
            )}
          </button>

          {/* Reset — only when filters are active */}
          {active && (
            <button
              type="button"
              onClick={onReset}
              className="flex h-8 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          {/* Spacer + result count */}
          <div className="flex-1" />
          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap pr-1" aria-live="polite" data-testid="result-count">
            {countLabel}
          </span>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="h-8 shrink-0 rounded-sm border border-border bg-background px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus:border-foreground/40"
            aria-label="Sort"
          >
            <option value="recent">Newest</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ── All filters slide-over drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[13px] font-semibold">All filters</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <FilterGroup label="Type">
                {([['all', 'Buy & Rent'], ['sale', 'For sale'], ['rent', 'For rent']] as const).map(
                  ([v, l]) => (
                    <FilterOption
                      key={v}
                      label={l}
                      selected={filters.type === v}
                      onClick={() => onChange({ type: v })}
                    />
                  ),
                )}
              </FilterGroup>

              <FilterGroup label="Price">
                <div className="-mx-4">
                  <PriceRange
                    key={`${filters.minPrice}-${filters.maxPrice}`}
                    min={filters.minPrice}
                    max={filters.maxPrice}
                    onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
                  />
                </div>
              </FilterGroup>

              <FilterGroup label="Category">
                <FilterOption
                  label="All categories"
                  selected={filters.category === 'all'}
                  onClick={() => onChange({ category: 'all' })}
                />
                {CATEGORIES.map((c) => (
                  <FilterOption
                    key={c.id}
                    label={c.label}
                    selected={filters.category === c.id}
                    onClick={() => onChange({ category: c.id })}
                  />
                ))}
              </FilterGroup>

              <FilterGroup label="Condition">
                <FilterOption
                  label="Any condition"
                  selected={filters.condition === 'all'}
                  onClick={() => onChange({ condition: 'all' })}
                />
                {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                  <FilterOption
                    key={v}
                    label={l}
                    selected={filters.condition === v}
                    onClick={() => onChange({ condition: v as Condition })}
                  />
                ))}
              </FilterGroup>

              <FilterGroup label="Pickup location">
                <FilterOption
                  label="All locations"
                  selected={filters.location === ''}
                  onClick={() => onChange({ location: '' })}
                />
                {PICKUP_LOCATIONS.map((loc) => (
                  <FilterOption
                    key={loc}
                    label={loc}
                    selected={filters.location === loc}
                    onClick={() => onChange({ location: loc })}
                  />
                ))}
              </FilterGroup>
            </div>

            <div className="flex gap-3 border-t border-border p-5">
              <button
                type="button"
                onClick={() => { onReset(); setDrawerOpen(false) }}
                className="flex-1 rounded-sm border border-border py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-sm bg-primary py-2.5 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Show {countLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-tag mb-3">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function FilterOption({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-[13px] text-left transition-colors',
        selected ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'h-3.5 w-3.5 shrink-0 rounded-full border transition-colors',
          selected ? 'border-foreground bg-foreground' : 'border-border',
        )}
      />
      {label}
    </button>
  )
}
