// Browse / search as database queries (indexes on category, type, status,
// created_at; full-text search on title, description, category, pickup).
// Listings are public: these work logged out too.

import type { CategoryId, Listing, ListingStatus, ListingType } from '../types'
import { db, unwrap, unwrapMaybe } from './client'
import { LISTING_COLUMNS, mapListing } from './mappers'

export type ListingSort = 'newest' | 'oldest' | 'price-asc' | 'price-desc'

export interface ListingSearch {
  /** Free text, web-search syntax: `desk -broken "mini fridge" or lamp`. */
  q?: string
  category?: CategoryId
  type?: ListingType
  /** Defaults to available only; pass 'all' for every status. */
  status?: ListingStatus | 'all'
  sellerId?: string
  minPrice?: number
  maxPrice?: number
  sort?: ListingSort
  limit?: number
  offset?: number
}

export async function searchListings(search: ListingSearch = {}): Promise<Listing[]> {
  let query = db().from('listings').select(LISTING_COLUMNS)
  if (search.q && search.q.trim()) {
    query = query.textSearch('search', search.q.trim(), { type: 'websearch', config: 'english' })
  }
  if (search.category) query = query.eq('category', search.category)
  if (search.type) query = query.eq('type', search.type)
  const status = search.status ?? 'available'
  if (status !== 'all') query = query.eq('status', status)
  if (search.sellerId) query = query.eq('seller_id', search.sellerId)
  if (search.minPrice !== undefined) query = query.gte('price', search.minPrice)
  if (search.maxPrice !== undefined) query = query.lte('price', search.maxPrice)

  const sort = search.sort ?? 'newest'
  query = query
    .order('featured', { ascending: false })
    .order(sort.startsWith('price') ? 'price' : 'created_at', {
      ascending: sort === 'oldest' || sort === 'price-asc',
    })
  const limit = search.limit ?? 60
  const offset = search.offset ?? 0
  const rows = unwrap(await query.range(offset, offset + limit - 1))
  return rows.map(mapListing)
}

export async function getListing(listingId: string): Promise<Listing | null> {
  const row = unwrapMaybe(await db().from('listings').select(LISTING_COLUMNS).eq('id', listingId).maybeSingle())
  return row ? mapListing(row) : null
}
