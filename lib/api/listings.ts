// Browse / search as database queries (indexes on category, type, status,
// created_at; full-text search on title, description, category, pickup).
// Listings are public: these work logged out too.

import type { CategoryId, Condition, Listing, ListingStatus, ListingType } from '../types'
import { db, unwrap, unwrapMaybe } from './client'
import { LISTING_COLUMNS, mapListing } from './mappers'

export type ListingSort = 'newest' | 'oldest' | 'price-asc' | 'price-desc'

export interface ListingSearch {
  /** Free text, web-search syntax: `desk -broken "mini fridge" or lamp`. */
  q?: string
  /**
   * How `q` matches. 'websearch' (default) uses web-search syntax. 'prefix'
   * also matches the start of each word ("fri" finds "fridge"), for search as
   * you type; it falls back to web-search when `q` uses quotes, `-` or `or`.
   */
  match?: 'websearch' | 'prefix'
  category?: CategoryId
  type?: ListingType
  condition?: Condition
  pickupLocation?: string
  /** Defaults to available only; pass 'all' for every status. */
  status?: ListingStatus | 'all'
  /** Several statuses at once; overrides `status`. */
  statuses?: ListingStatus[]
  /** Only these listings (e.g. the user's favourites). An empty list matches nothing. */
  ids?: string[]
  sellerId?: string
  minPrice?: number
  maxPrice?: number
  sort?: ListingSort
  limit?: number
  offset?: number
}

export interface ListingPage {
  listings: Listing[]
  /** Every listing that matches the filters, across all pages. */
  total: number
}

const WEBSEARCH_SYNTAX = /["()]|(^|\s)-\S|\sor\s/i

/** `desk lam` → `desk:* & lam:*` (letters and digits only, so it can't be a syntax error). */
function prefixTsQuery(text: string): string | null {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return words.length > 0 ? words.map((word) => `${word}:*`).join(' & ') : null
}

function buildQuery(search: ListingSearch, count: boolean) {
  let query = db().from('listings').select(LISTING_COLUMNS, count ? { count: 'exact' } : undefined)
  const text = search.q?.trim()
  if (text) {
    const prefix = search.match === 'prefix' && !WEBSEARCH_SYNTAX.test(text) ? prefixTsQuery(text) : null
    query = prefix
      ? query.textSearch('search', prefix, { config: 'english' })
      : query.textSearch('search', text, { type: 'websearch', config: 'english' })
  }
  if (search.category) query = query.eq('category', search.category)
  if (search.type) query = query.eq('type', search.type)
  if (search.condition) query = query.eq('condition', search.condition)
  if (search.pickupLocation) query = query.eq('pickup_location', search.pickupLocation)
  if (search.statuses && search.statuses.length > 0) {
    query = query.in('status', search.statuses)
  } else {
    const status = search.status ?? 'available'
    if (status !== 'all') query = query.eq('status', status)
  }
  if (search.ids) query = query.in('id', search.ids)
  if (search.sellerId) query = query.eq('seller_id', search.sellerId)
  if (search.minPrice !== undefined) query = query.gte('price', search.minPrice)
  if (search.maxPrice !== undefined) query = query.lte('price', search.maxPrice)

  // Featured first (is_featured honours featured_until; migration 20261025020400).
  const sort = search.sort ?? 'newest'
  query = query
    .order('is_featured', { ascending: false })
    .order(sort.startsWith('price') ? 'price' : 'created_at', {
      ascending: sort === 'oldest' || sort === 'price-asc',
    })
    .order('id')
  const limit = search.limit ?? 60
  const offset = search.offset ?? 0
  return query.range(offset, offset + limit - 1)
}

export async function searchListings(search: ListingSearch = {}): Promise<Listing[]> {
  if (search.ids && search.ids.length === 0) return []
  const rows = unwrap(await buildQuery(search, false))
  return rows.map(mapListing)
}

/** One page of results plus the total number of matches (for "N items" and "Load more"). */
export async function searchListingsPage(search: ListingSearch = {}): Promise<ListingPage> {
  if (search.ids && search.ids.length === 0) return { listings: [], total: 0 }
  const result = await buildQuery(search, true)
  const rows = unwrap(result)
  return { listings: rows.map(mapListing), total: result.count ?? rows.length }
}

export async function getListing(listingId: string): Promise<Listing | null> {
  const row = unwrapMaybe(await db().from('listings').select(LISTING_COLUMNS).eq('id', listingId).maybeSingle())
  return row ? mapListing(row) : null
}
