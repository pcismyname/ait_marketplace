'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Inbox, RotateCcw, Search } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, CATEGORIES, categoryLabel } from '@/lib/data'
import type { CategoryId, ListingType } from '@/lib/types'
import { ProductCard } from '@/components/listing-card'
import { FilterBar, type FilterState } from '@/components/filter-bar'

const DEFAULT_FILTERS: FilterState = {
  type: 'all',
  category: 'all',
  condition: 'all',
  location: '',
  sort: 'recent',
}

function HomeInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { listings } = useMarketplace()

  const [filters, setFilters] = useState<FilterState>({
    type: (searchParams.get('type') as ListingType | 'all') ?? 'all',
    category: (searchParams.get('category') as CategoryId | 'all') ?? 'all',
    condition: 'all',
    location: '',
    sort: 'recent',
  })
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Update URL so it's shareable, but also update local state
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (filters.category !== 'all') params.set('category', filters.category)
    router.push(`/?${params.toString()}`)
    setPage(1)
  }

  const onChange = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }
  const onReset = () => { setFilters(DEFAULT_FILTERS); setQuery(''); setPage(1) }

  const results = useMemo(() => {
    let out = listings.filter((l) => {
      // hide paused/sold items unless status filter active
      if (l.status === 'paused' || l.status === 'sold') return false
      if (filters.type !== 'all' && l.type !== filters.type) return false
      if (filters.category !== 'all' && l.category !== filters.category) return false
      if (filters.condition !== 'all' && l.condition !== filters.condition) return false
      if (filters.location && l.pickupLocation !== filters.location) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        if (!l.title.toLowerCase().includes(q) && !l.description.toLowerCase().includes(q)) return false
      }
      return true
    })
    return [...out].sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1
      if (filters.sort === 'price-asc') return a.price - b.price
      if (filters.sort === 'price-desc') return b.price - a.price
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
  }, [listings, filters, query])

  const visible = results.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < results.length

  return (
    <div>
      {/* ── Minimal Search Hero ── */}
      <section className="border-b border-border bg-background pt-10 pb-8">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          {/* Search */}
          <form onSubmit={onSearch} className="mx-auto flex max-w-2xl gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search furniture, electronics, bikes..."
                className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-[14px] outline-none shadow-sm transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                aria-label="Search listings"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-primary px-6 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </form>

          {/* Inline Categories */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3 text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            {CATEGORIES.filter((c) => c.id !== 'other').map((cat, index, array) => {
              const isActive = filters.category === cat.id
              return (
                <span key={cat.id} className="flex items-center gap-3">
                  <button
                    onClick={() => onChange({ category: cat.id })}
                    className={`hover:text-primary transition-colors ${isActive ? 'text-foreground font-bold' : ''}`}
                  >
                    {cat.label}
                  </button>
                  {index < array.length - 1 && (
                    <span className="text-border">|</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      {/* Filter bar — sticky under header */}
      <FilterBar
        filters={filters}
        resultCount={results.length}
        onChange={onChange}
        onReset={onReset}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Product grid */}
        {visible.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((listing) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-sm border border-border px-8 py-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  Load more ({results.length - visible.length} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center py-24 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
            <p className="mt-4 text-[15px] font-medium">No items match</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Try adjusting your filters or clearing them to see everything.
            </p>
            <button
              onClick={onReset}
              className="mt-5 flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface mt-16">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            <div className="sm:w-44 shrink-0">
              <p className="font-display text-[15px] font-bold italic text-foreground">{BRAND}</p>
              <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
                Student-only circular marketplace for AIT.
                Buy, sell, and rent — cohort to cohort.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3 flex-1">
              <FooterGroup title="Marketplace" links={[
                { href: '/', label: 'Browse all' },
                { href: '/?type=rent', label: 'For rent' },
                { href: '/my-listings', label: 'My listings' },
                { href: '/sell', label: 'List an item' },
              ]} />
              <FooterGroup title="Account" links={[
                { href: '/needs', label: 'Pre-arrival needs' },
                { href: '/rentals', label: 'My rentals' },
                { href: '/chat', label: 'Messages' },
              ]} />
              <FooterGroup title="Course project" links={[
                { label: 'AST02.21 — E-Business' },
                { label: 'Samichi · Chidsanuphong · Lucja' },
              ]} />
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5 text-[11px] text-muted-foreground">
            <p>© {new Date().getFullYear()} AIT Circular Marketplace</p>
            <p className="hidden sm:block">For students, by students · Asian Institute of Technology</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterGroup({ title, links }: { title: string; links: { href?: string; label: string }[] }) {
  return (
    <div>
      <p className="label-tag mb-3">{title}</p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.href
              ? <Link href={l.href} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
              : <span className="text-[12px] text-muted-foreground">{l.label}</span>
            }
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Skeleton grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] animate-pulse bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  )
}
