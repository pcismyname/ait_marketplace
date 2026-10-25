'use client'

// Browse and search as database queries (lib/api searchListingsPage: indexed
// filters + the full-text index on title, description, category, pickup).
// The URL query string is the source of truth, so every view is a shareable
// link: /browse?q=desk&type=rent&category=furniture&min=100&max=900&sort=price-asc
// Featured listings come first (public.is_featured honours featured_until).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Inbox, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { searchListingsPage } from '@/lib/api'
import { categoryLabel } from '@/lib/data'
import { useMarketplace } from '@/lib/store'
import type { Listing, ListingStatus } from '@/lib/types'
import { ProductCard } from '@/components/listing-card'
import {
  FilterBar, filtersFromParams, paramsWithFilters, toApiSort, type FilterState,
} from '@/components/filter-bar'

export const BROWSE_PAGE_SIZE = 24
/** Browse shows what can still change hands (paused and sold items are hidden). */
const BROWSE_STATUSES: ListingStatus[] = ['available', 'reserved', 'rented']

// The newest browse query string, shared by every useBrowseParams() on the
// page (the search box and the grid each call it). It includes a replace()
// that hasn't rendered yet, so a delayed update (the search box's debounce)
// builds on the latest filters instead of the ones from an older render.
const latestQuery = { path: '', query: '' }

/** Read and update the browse filters in the URL. */
export function useBrowseParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const key = searchParams.toString()
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(key)), [key])
  useEffect(() => {
    latestQuery.path = pathname
    latestQuery.query = key
  }, [pathname, key])
  const base = useCallback(() => (latestQuery.path === pathname ? latestQuery.query : key), [pathname, key])
  const update = useCallback((change: Partial<FilterState>) => {
    const next = paramsWithFilters(new URLSearchParams(base()), change).toString()
    latestQuery.path = pathname
    latestQuery.query = next
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [base, pathname, router])
  const reset = useCallback(() => {
    latestQuery.path = pathname
    latestQuery.query = ''
    router.replace(pathname, { scroll: false })
  }, [pathname, router])
  /** The filters as of now (not as of the render that created the callback). */
  const current = useCallback(() => filtersFromParams(new URLSearchParams(base())), [base])
  return { filters, key, update, reset, current }
}

/** The big search box above the grid; types into ?q= after a short pause. */
export function BrowseSearch() {
  const { filters, update, current } = useBrowseParams()
  const [text, setText] = useState(filters.q)
  const [lastQ, setLastQ] = useState(filters.q)
  // Follow the URL when it changes elsewhere (header search, back button, Clear).
  if (filters.q !== lastQ) {
    setLastQ(filters.q)
    setText(filters.q)
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const commit = (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (value.trim() !== current().q.trim()) update({ q: value })
  }

  return (
    <div className="bg-background pt-12 pb-16">
      <div className="w-full px-4 lg:px-12 xl:px-20">
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); commit(text) }}
          className="flex w-full md:max-w-4xl mx-auto items-center gap-4 bg-surface rounded-full px-6 py-4 md:px-8 md:py-6 shadow-sm transition-all focus-within:ring-4 focus-within:ring-primary/20 focus-within:shadow-md"
        >
          <Search className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
          <input
            type="search"
            name="q"
            aria-label="Search listings"
            placeholder="Search everything..."
            className="w-full min-w-0 bg-transparent text-xl md:text-3xl font-display outline-none placeholder:text-muted-foreground/60 text-foreground"
            value={text}
            onChange={(e) => {
              const value = e.target.value
              setText(value)
              if (timer.current) clearTimeout(timer.current)
              timer.current = setTimeout(() => commit(value), 350)
            }}
          />
          <button type="submit" className="hidden md:flex shrink-0 bg-primary text-primary-foreground rounded-full px-6 py-3 text-[13px] font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
            Search
          </button>
        </form>
      </div>
    </div>
  )
}

interface Results {
  key: string
  listings: Listing[]
  total: number
}

export function ListingBrowser() {
  const { filters, key, update, reset } = useBrowseParams()
  const { favoriteIds, isAuthenticated, getUser } = useMarketplace()
  const favoriteKey = filters.favorites ? [...favoriteIds].sort().join(',') : ''

  const [results, setResults] = useState<Results | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [retry, setRetry] = useState(0)
  const requestKey = `${key}|${favoriteKey}|${retry}`

  const query = useMemo(() => ({
    q: filters.q || undefined,
    match: 'prefix' as const,
    type: filters.type === 'all' ? undefined : filters.type,
    category: filters.category === 'all' ? undefined : filters.category,
    condition: filters.condition === 'all' ? undefined : filters.condition,
    pickupLocation: filters.location || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sellerId: filters.sellerId,
    ids: filters.favorites ? (favoriteKey ? favoriteKey.split(',') : []) : undefined,
    statuses: BROWSE_STATUSES,
    sort: toApiSort(filters.sort),
    limit: BROWSE_PAGE_SIZE,
  }), [filters, favoriteKey])

  // First page whenever the filters change. Stale responses are ignored.
  useEffect(() => {
    let cancelled = false
    searchListingsPage({ ...query, offset: 0 }).then(
      (page) => {
        if (cancelled) return
        setResults({ key: requestKey, ...page })
        setError(null)
      },
      (err: Error) => {
        if (!cancelled) setError({ key: requestKey, message: err.message })
      },
    )
    return () => { cancelled = true }
  }, [query, requestKey])

  const current = results?.key === requestKey ? results : null
  const failed = error?.key === requestKey ? error.message : null
  const loading = !current && !failed

  const loadMore = async () => {
    if (!current) return
    setLoadingMore(true)
    try {
      const page = await searchListingsPage({ ...query, offset: current.listings.length })
      setResults((prev) => (prev && prev.key === current.key
        ? { ...prev, total: page.total, listings: [...prev.listings, ...page.listings.filter((l) => !prev.listings.some((p) => p.id === l.id))] }
        : prev))
    } catch (err) {
      setError({ key: requestKey, message: (err as Error).message })
    } finally {
      setLoadingMore(false)
    }
  }

  const visible = current?.listings ?? []
  const remaining = current ? Math.max(0, current.total - visible.length) : 0

  return (
    <>
      <FilterBar
        filters={filters}
        resultCount={current?.total}
        onChange={update}
        onReset={reset}
      />

      <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
        {/* Section label */}
        {filters.category !== 'all' && (
          <div className="mb-10">
            <h2 className="font-display text-4xl font-bold tracking-tight">
              {categoryLabel(filters.category)}
            </h2>
          </div>
        )}

        {(filters.q || filters.sellerId || filters.favorites) && (
          <div className="mb-8 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            {filters.q && (
              <ActiveTag label={`“${filters.q}”`} onClear={() => update({ q: '' })} />
            )}
            {filters.sellerId && (
              <ActiveTag label={`Listed by ${getUser(filters.sellerId).name}`} onClear={() => update({ sellerId: undefined })} />
            )}
            {filters.favorites && (
              <ActiveTag label="Your favourites" onClear={() => update({ favorites: false })} />
            )}
          </div>
        )}

        {failed ? (
          <div className="flex flex-col items-center py-24 text-center" role="alert">
            <AlertCircle className="h-6 w-6 text-destructive/60" />
            <p className="mt-4 text-[15px] font-medium">Couldn&apos;t load listings</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{failed}</p>
            <button
              onClick={() => setRetry((n) => n + 1)}
              className="mt-5 flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" data-testid="browse-loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[3/4] animate-pulse bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3" data-testid="browse-grid">
              {visible.map((listing) => (
                <ProductCard key={listing.id} listing={listing} />
              ))}
            </div>

            {remaining > 0 && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-sm border border-border px-8 py-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load more ({remaining} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center py-24 text-center" data-testid="browse-empty">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
            <p className="mt-4 text-[15px] font-medium">
              {filters.favorites && !isAuthenticated ? 'Log in to see your favourites' : filters.favorites ? 'No favourites yet' : 'No items match'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {filters.favorites
                ? 'Tap the heart on a listing to save it here.'
                : 'Try another word, or adjust or clear your filters to see everything.'}
            </p>
            <button
              onClick={reset}
              className="mt-5 flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function ActiveTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-foreground">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

