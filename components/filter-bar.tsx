'use client'

import { Fragment, useState } from 'react'
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { CATEGORIES, CONDITION_LABELS, PICKUP_LOCATIONS } from '@/lib/data'
import type { CategoryId, Condition, ListingType } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface FilterState {
  type: ListingType | 'all'
  category: CategoryId | 'all'
  condition: Condition | 'all'
  location: string
  sort: SortKey
}
export type SortKey = 'recent' | 'price-asc' | 'price-desc'

interface FilterBarProps {
  filters: FilterState
  resultCount: number
  onChange: (f: Partial<FilterState>) => void
  onReset: () => void
}

// Small dropdown chip
function Chip({
  label,
  active,
  options,
  value,
  onSelect,
}: {
  label: string
  active: boolean
  options: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
          active
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        )}
      >
        {label}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-sm border border-border bg-background shadow-md">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); setOpen(false) }}
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
          </div>
        </>
      )}
    </div>
  )
}

export function FilterBar({ filters, resultCount, onChange, onReset }: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const hasActiveFilters =
    filters.type !== 'all' || filters.category !== 'all' ||
    filters.condition !== 'all' || filters.location !== ''

  return (
    <>
      {/* ── Slim filter bar ── */}
      <div className="sticky top-12 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-2 overflow-x-auto px-4 md:px-6 no-scrollbar">

          {/* Type chip */}
          <Chip
            label="Type"
            active={filters.type !== 'all'}
            value={filters.type}
            options={[
              { value: 'all', label: 'Buy & Rent' },
              { value: 'sale', label: 'For sale' },
              { value: 'rent', label: 'For rent' },
            ]}
            onSelect={(v) => onChange({ type: v as FilterState['type'] })}
          />

          {/* Category chip */}
          <Chip
            label="Category"
            active={filters.category !== 'all'}
            value={filters.category}
            options={[
              { value: 'all', label: 'All categories' },
              ...CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
            ]}
            onSelect={(v) => onChange({ category: v as FilterState['category'] })}
          />

          {/* Condition chip */}
          <Chip
            label="Condition"
            active={filters.condition !== 'all'}
            value={filters.condition}
            options={[
              { value: 'all', label: 'Any condition' },
              ...Object.entries(CONDITION_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
            onSelect={(v) => onChange({ condition: v as FilterState['condition'] })}
          />

          {/* Location chip */}
          <Chip
            label="Location"
            active={filters.location !== ''}
            value={filters.location || 'all'}
            options={[
              { value: 'all', label: 'All locations' },
              ...PICKUP_LOCATIONS.map((l) => ({ value: l, label: l })),
            ]}
            onSelect={(v) => onChange({ location: v === 'all' ? '' : v })}
          />

          {/* All filters drawer trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <SlidersHorizontal className="h-3 w-3" />
            All filters
            {hasActiveFilters && (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                !
              </span>
            )}
          </button>

          {/* Reset — only when filters are active */}
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex h-8 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          {/* Spacer + result count */}
          <div className="flex-1" />
          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap pr-1">
            {resultCount} {resultCount === 1 ? 'item' : 'items'}
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
          <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[13px] font-semibold">All filters</h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* Type */}
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

              {/* Category */}
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

              {/* Condition */}
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

              {/* Location */}
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
                onClick={() => { onReset(); setDrawerOpen(false) }}
                className="flex-1 rounded-sm border border-border py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-sm bg-primary py-2.5 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Show {resultCount} items
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
