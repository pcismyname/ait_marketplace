'use client'

import { Suspense, useMemo, useState } from 'react'
import {
  useSearchParams,
  useRouter,
  type ReadonlyURLSearchParams,
} from 'next/navigation'
import { Search, SlidersHorizontal, Inbox } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES } from '@/lib/data'
import type { CategoryId, ListingType } from '@/lib/types'
import { ListingCard } from '@/components/listing-card'
import { CategoryIcon } from '@/components/category-icon'
import { cn } from '@/lib/utils'

type SortKey = 'recent' | 'price-asc' | 'price-desc'

const TYPE_VALUES: (ListingType | 'all')[] = ['all', 'sale', 'rent']

function typeFromParams(params: ReadonlyURLSearchParams): ListingType | 'all' {
  const t = params.get('type')
  return t === 'sale' || t === 'rent' ? t : 'all'
}

function categoryFromParams(params: ReadonlyURLSearchParams): CategoryId | 'all' {
  const c = params.get('category')
  return CATEGORIES.some((cat) => cat.id === c) ? (c as CategoryId) : 'all'
}

/**
 * The URL is the source of truth for category and type. The search box keeps
 * local state seeded from ?q= and is remounted (via key) when that param
 * changes, so no effect is needed to keep state and URL in sync.
 */
function BrowseInner({ params }: { params: ReadonlyURLSearchParams }) {
  const router = useRouter()
  const { listings } = useMarketplace()

  const category = categoryFromParams(params)
  const type = typeFromParams(params)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<SortKey>('recent')

  const results = useMemo(() => {
    let out = listings.filter((l) => {
      if (category !== 'all' && l.category !== category) return false
      if (type !== 'all' && l.type !== type) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        if (
          !l.title.toLowerCase().includes(q) &&
          !l.description.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
    out = [...out].sort((a, b) => {
      // Premium placement floats to the top regardless of sort.
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
    return out
  }, [listings, category, type, query, sort])

  const updateUrl = (mutate: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(Array.from(params.entries()))
    mutate(sp)
    router.replace(`/browse${sp.toString() ? `?${sp}` : ''}`, { scroll: false })
  }

  const setCategory = (cat: CategoryId | 'all') =>
    updateUrl((sp) => (cat === 'all' ? sp.delete('category') : sp.set('category', cat)))

  const setType = (t: ListingType | 'all') =>
    updateUrl((sp) => (t === 'all' ? sp.delete('type') : sp.set('type', t)))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Browse the marketplace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? 'item' : 'items'} available across the
          AIT community.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or description…"
          className="h-11 w-full rounded-full border border-input bg-card pl-11 pr-4 text-sm outline-none transition focus:border-ring"
          aria-label="Search listings"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>
          All categories
        </FilterChip>
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat.id}
            active={category === cat.id}
            onClick={() => setCategory(cat.id)}
          >
            <CategoryIcon category={cat.id} className="h-3.5 w-3.5" />
            {cat.label}
          </FilterChip>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </span>
        <div className="flex gap-1 rounded-full bg-secondary p-1">
          {TYPE_VALUES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize transition',
                type === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'all' ? 'Buy & Rent' : `For ${t}`}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto h-9 rounded-full border border-input bg-card px-3 text-xs font-medium outline-none focus:border-ring"
          aria-label="Sort listings"
        >
          <option value="recent">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No items match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different category or clear your search.
          </p>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function BrowseRoute() {
  const params = useSearchParams()
  return <BrowseInner key={params.get('q') ?? ''} params={params} />
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8">Loading…</div>}>
      <BrowseRoute />
    </Suspense>
  )
}
