'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Inbox, RotateCcw, ArrowRight, Search } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES, categoryLabel } from '@/lib/data'
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

// Category icons mapping (simple emoji-free visual chips)
const CATEGORY_ICONS: Record<string, string> = {
  furniture: '🪑',
  electronics: '🔌',
  bicycles: '🚲',
  textbooks: '📚',
  kitchen: '🍳',
  sports: '🏸',
  other: '📦',
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
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const onChange = (partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }
  const onReset = () => { setFilters(DEFAULT_FILTERS); setPage(1) }

  const results = useMemo(() => {
    let out = listings.filter((l) => {
      if (l.status === 'paused' || l.status === 'sold') return false
      if (filters.type !== 'all' && l.type !== filters.type) return false
      if (filters.category !== 'all' && l.category !== filters.category) return false
      if (filters.condition !== 'all' && l.condition !== filters.condition) return false
      if (filters.location && l.pickupLocation !== filters.location) return false
      return true
    })
    return [...out].sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1
      if (filters.sort === 'price-asc') return a.price - b.price
      if (filters.sort === 'price-desc') return b.price - a.price
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
  }, [listings, filters])

  const visible = results.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < results.length

  const activeCount = listings.filter((l) => l.status === 'available').length

  return (
    <div>
      {/* ── Editorial Search Hero ── */}
      <div className="bg-background pt-12 pb-16">
        <div className="w-full px-4 lg:px-12 xl:px-20">
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              router.push(searchParams.get('q') ? `/?q=${searchParams.get('q')}` : '/')
            }}
            className="flex w-full md:max-w-4xl mx-auto items-center gap-4 bg-surface rounded-full px-6 py-4 md:px-8 md:py-6 shadow-sm transition-all focus-within:ring-4 focus-within:ring-primary/20 focus-within:shadow-md"
          >
            <Search className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
            <input
              type="search"
              placeholder="Search everything..."
              className="w-full bg-transparent text-xl md:text-3xl font-display outline-none placeholder:text-muted-foreground/60 text-foreground"
              defaultValue={searchParams.get('q') || ''}
              onChange={(e) => {
                const url = new URL(window.location.href)
                if (e.target.value) {
                  url.searchParams.set('q', e.target.value)
                } else {
                  url.searchParams.delete('q')
                }
                router.replace(url.pathname + url.search)
              }}
            />
            <button type="submit" className="hidden md:flex shrink-0 bg-primary text-primary-foreground rounded-full px-6 py-3 text-[13px] font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        resultCount={results.length}
        onChange={onChange}
        onReset={onReset}
      />

      <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
        {/* Section label */}
        {filters.category !== 'all' && (
          <div className="mb-10">
            <h2 className="font-display text-4xl font-bold tracking-tight">
              {categoryLabel(filters.category as CategoryId)}
            </h2>
          </div>
        )}

        {/* Product grid */}
        {visible.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
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
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
            <div className="sm:w-52 shrink-0">
              <Image
                src="/logo/passiton-logo.svg"
                alt="PassItOn"
                width={120}
                height={36}
                className="h-8 w-auto dark:hidden"
              />
              <Image
                src="/logo/passiton-logo-reversed.svg"
                alt="PassItOn"
                width={120}
                height={36}
                className="h-8 w-auto hidden dark:block"
              />
              <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
                Student-only circular marketplace for AIT.
                Buy, sell, and rent — cohort to cohort.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                AIT email verified only
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3 flex-1">
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
          <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-[11px] text-muted-foreground">
            <p>© {new Date().getFullYear()} PassItOn</p>
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
      <ul className="space-y-2.5">
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
