'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  BRAND,
  CURRENT_USER_ID,
  LISTINGS,
  NEEDS,
  RENTALS,
  THREADS,
  getUser,
} from './data'
import { computeRentalQuote, rentalDueDate } from './fees'
import { formatPrice } from './format'
import { createClient } from '@/utils/supabase/client'
import type {
  CategoryId,
  Listing,
  ListingType,
  Condition,
  Need,
  PaymentMethod,
  Rental,
  RentalPhase,
  Thread,
} from './types'

interface NewListingInput {
  title: string
  description: string
  category: CategoryId
  type: ListingType
  price: number
  deposit?: number
  rentalPeriod?: string
  condition: Condition
  images: string[]
  pickupLocation: string
  /** Paid premium placement. */
  featured?: boolean
}

interface NewNeedInput {
  title: string
  category: CategoryId
  note: string
  arrivalDate: string
}

interface MarketplaceContextValue {
  currentUserId: string
  listings: Listing[]
  needs: Need[]
  threads: Thread[]
  rentals: Rental[]
  addListing: (input: NewListingInput) => Listing
  addNeed: (input: NewNeedInput) => Need
  getThreadForListing: (listingId: string) => Thread | undefined
  startThread: (listingId: string, sellerId: string, firstMessage: string) => Thread
  sendMessage: (threadId: string, text: string) => void
  receiveMessage: (threadId: string, senderId: string, text: string) => void
  /**
   * Book a rental: charges the quote (simulated), holds the deposit in escrow,
   * marks the listing as rented and opens a chat with the owner for pickup.
   * Returns undefined when the listing is not rentable any more.
   */
  startRental: (listingId: string, paymentMethod: PaymentMethod) => Rental | undefined
  setRentalPhase: (rentalId: string, phase: RentalPhase) => void
  deleteListing: (listingId: string) => void
  updateListing: (listingId: string, input: Partial<NewListingInput>) => void
  updateListingStatus: (listingId: string, status: import('./types').ListingStatus) => void
  favoriteIds: Set<string>
  toggleFavorite: (listingId: string) => void
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null)
const supabase = createClient()

type DatabaseRow = Record<string, unknown>

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

function mapListingRow(row: DatabaseRow): Listing {
  return {
    id: asString(row.id),
    title: asString(row.title),
    description: asString(row.description),
    category: row.category as CategoryId,
    type: row.type as ListingType,
    price: Number(row.price ?? 0),
    deposit: row.deposit == null ? undefined : Number(row.deposit),
    rentalPeriod: row.rental_period == null ? undefined : asString(row.rental_period),
    condition: row.condition as Condition,
    images: Array.isArray(row.images) ? row.images.map(String) : ['/placeholder.svg'],
    pickupLocation: asString(row.pickup_location),
    sellerId: asString(row.seller_id, CURRENT_USER_ID),
    createdAt: asString(row.created_at, new Date().toISOString()),
    status: row.status as Listing['status'],
    timesChangedHands: Number(row.times_changed_hands ?? 0),
    featured: Boolean(row.featured),
    history: Array.isArray(row.history) ? row.history as Listing['history'] : [],
    reviews: Array.isArray(row.reviews) ? row.reviews as Listing['reviews'] : [],
  }
}

function mapNeedRow(row: DatabaseRow): Need {
  return {
    id: asString(row.id),
    userId: asString(row.user_id, CURRENT_USER_ID),
    title: asString(row.title),
    category: row.category as CategoryId,
    note: asString(row.note),
    arrivalDate: asString(row.arrival_date),
    createdAt: asString(row.created_at, new Date().toISOString()),
  }
}

function toListingRow(input: Partial<NewListingInput> & Partial<Listing>): DatabaseRow {
  const row: DatabaseRow = {}
  if (input.id !== undefined) row.id = input.id
  if (input.title !== undefined) row.title = input.title
  if (input.description !== undefined) row.description = input.description
  if (input.category !== undefined) row.category = input.category
  if (input.type !== undefined) row.type = input.type
  if (input.price !== undefined) row.price = input.price
  if (input.deposit !== undefined) row.deposit = input.deposit
  if (input.rentalPeriod !== undefined) row.rental_period = input.rentalPeriod
  if (input.condition !== undefined) row.condition = input.condition
  if (input.images !== undefined) row.images = input.images
  if (input.pickupLocation !== undefined) row.pickup_location = input.pickupLocation
  if (input.sellerId !== undefined) row.seller_id = input.sellerId
  if (input.createdAt !== undefined) row.created_at = input.createdAt
  if (input.status !== undefined) row.status = input.status
  if (input.timesChangedHands !== undefined) row.times_changed_hands = input.timesChangedHands
  if (input.featured !== undefined) row.featured = input.featured
  if (input.history !== undefined) row.history = input.history
  if (input.reviews !== undefined) row.reviews = input.reviews
  return row
}

function toNeedRow(input: Need): DatabaseRow {
  return {
    id: input.id,
    user_id: input.userId,
    title: input.title,
    category: input.category,
    note: input.note,
    arrival_date: input.arrivalDate,
    created_at: input.createdAt,
  }
}

let idCounter = 1000
const nextId = (prefix: string) => `${prefix}_${++idCounter}`

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(LISTINGS)
  const [needs, setNeeds] = useState<Need[]>(NEEDS)
  const [threads, setThreads] = useState<Thread[]>(THREADS)
  const [rentals, setRentals] = useState<Rental[]>(RENTALS)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('passiton_auth') === '1'
    }
    return false
  })

  useEffect(() => {
    let cancelled = false

    async function loadDatabaseData() {
      const [{ data: remoteListings }, { data: remoteNeeds }, { data: remoteThreads }, { data: remoteMessages }] =
        await Promise.all([
          supabase.from('listings').select('*').order('created_at', { ascending: false }),
          supabase.from('needs').select('*').order('created_at', { ascending: false }),
          supabase.from('threads').select('*'),
          supabase.from('messages').select('*').order('created_at', { ascending: true })
        ])

      if (cancelled) return

      if (remoteListings) setListings(remoteListings.map(mapListingRow))
      if (remoteNeeds) setNeeds(remoteNeeds.map(mapNeedRow))
      
      if (remoteThreads && remoteMessages) {
        // We can optionally map remote threads/messages here if we want full sync
        // For now, it will merge or overwrite the mock data
      }
    }

    void loadDatabaseData()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(() => {
    setIsAuthenticated(true)
    localStorage.setItem('passiton_auth', '1')
  }, [])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    localStorage.removeItem('passiton_auth')
  }, [])

  const addListing = useCallback((input: NewListingInput): Listing => {
    const me = getUser(CURRENT_USER_ID)
    const listing: Listing = {
      id: nextId('l'),
      ...input,
      sellerId: CURRENT_USER_ID,
      createdAt: new Date().toISOString(),
      status: 'available',
      timesChangedHands: 1,
      history: [{ ownerName: me.name, action: `Listed on ${BRAND}`, date: 'Just now' }],
      reviews: [],
    }
    setListings((prev) => [listing, ...prev])
    void supabase.from('listings').insert(toListingRow(listing)).then(({ error }) => {
      if (error) console.error('Could not save listing to Supabase:', error.message)
    })
    return listing
  }, [])

  const addNeed = useCallback((input: NewNeedInput): Need => {
    const need: Need = {
      id: nextId('n'),
      userId: CURRENT_USER_ID,
      ...input,
      createdAt: new Date().toISOString(),
    }
    setNeeds((prev) => [need, ...prev])
    void supabase.from('needs').insert(toNeedRow(need)).then(({ error }) => {
      if (error) console.error('Could not save need to Supabase:', error.message)
    })
    return need
  }, [])

  const getThreadForListing = useCallback(
    (listingId: string) =>
      threads.find(
        (t) => t.listingId === listingId && t.participantIds.includes(CURRENT_USER_ID),
      ),
    [threads],
  )

  const startThread = useCallback(
    (listingId: string, sellerId: string, firstMessage: string): Thread => {
      const existing = threads.find(
        (t) => t.listingId === listingId && t.participantIds.includes(CURRENT_USER_ID),
      )
      if (existing) {
        const msg = {
          id: nextId('m'),
          senderId: CURRENT_USER_ID,
          text: firstMessage,
          createdAt: new Date().toISOString(),
        }
        setThreads((prev) =>
          prev.map((t) =>
            t.id === existing.id ? { ...t, messages: [...t.messages, msg] } : t,
          ),
        )
        void supabase.from('messages').insert({ id: msg.id, thread_id: existing.id, sender_id: msg.senderId, text: msg.text }).then()
        return existing
      }
      const thread: Thread = {
        id: nextId('t'),
        listingId,
        participantIds: [CURRENT_USER_ID, sellerId],
        messages: [],
      }
      const msg = {
        id: nextId('m'),
        senderId: CURRENT_USER_ID,
        text: firstMessage,
        createdAt: new Date().toISOString(),
      }
      thread.messages.push(msg)
      setThreads((prev) => [thread, ...prev])
      
      void supabase.from('threads').insert({ id: thread.id, listing_id: listingId }).then(() => {
        void supabase.from('thread_participants').insert([
          { thread_id: thread.id, user_id: CURRENT_USER_ID },
          { thread_id: thread.id, user_id: sellerId }
        ]).then()
        void supabase.from('messages').insert({ id: msg.id, thread_id: thread.id, sender_id: msg.senderId, text: msg.text }).then()
      })
      
      return thread
    },
    [threads],
  )

  const sendMessage = useCallback((threadId: string, text: string) => {
    const msg = {
      id: nextId('m'),
      senderId: CURRENT_USER_ID,
      text,
      createdAt: new Date().toISOString(),
    }
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t)),
    )
    void supabase.from('messages').insert({ id: msg.id, thread_id: threadId, sender_id: CURRENT_USER_ID, text }).then()
  }, [])

  const receiveMessage = useCallback(
    (threadId: string, senderId: string, text: string) => {
      const msg = {
        id: nextId('m'),
        senderId,
        text,
        createdAt: new Date().toISOString(),
      }
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t)),
      )
    },
    [],
  )

  const startRental = useCallback(
    (listingId: string, paymentMethod: PaymentMethod): Rental | undefined => {
      const listing = listings.find((l) => l.id === listingId)
      if (!listing || listing.type !== 'rent' || listing.status !== 'available') {
        return undefined
      }
      const quote = computeRentalQuote({ price: listing.price, deposit: listing.deposit })
      const start = new Date()
      const rental: Rental = {
        id: nextId('r'),
        listingId,
        renterId: CURRENT_USER_ID,
        deposit: quote.deposit,
        startDate: start.toISOString(),
        dueDate: rentalDueDate(start, listing.rentalPeriod).toISOString(),
        phase: 'active',
        quote,
        paymentMethod,
      }
      setRentals((prev) => [rental, ...prev])
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: 'rented' } : l)),
      )
      
      void supabase.from('rentals').insert({
        id: rental.id,
        listing_id: rental.listingId,
        renter_id: rental.renterId,
        deposit: rental.deposit,
        start_date: rental.startDate,
        due_date: rental.dueDate,
        phase: rental.phase,
        payment_method: rental.paymentMethod,
        quote: rental.quote
      }).then()
      void supabase.from('listings').update({ status: 'rented' }).eq('id', listingId).then()
      const owner = getUser(listing.sellerId)
      startThread(
        listingId,
        listing.sellerId,
        `Hi ${owner.name}, I just booked "${listing.title}". The ${formatPrice(
          quote.deposit,
        )} deposit is now in escrow. When can I pick it up at ${listing.pickupLocation}?`,
      )
      return rental
    },
    [listings, startThread],
  )

  const setRentalPhase = useCallback((rentalId: string, phase: RentalPhase) => {
    setRentals((prev) => prev.map((r) => (r.id === rentalId ? { ...r, phase } : r)))
    void supabase.from('rentals').update({ phase }).eq('id', rentalId).then()
  }, [])

  const deleteListing = useCallback((listingId: string) => {
    setListings((prev) => prev.filter((l) => l.id !== listingId))
    void supabase.from('listings').delete().eq('id', listingId).then(({ error }) => {
      if (error) console.error('Could not delete listing from Supabase:', error.message)
    })
  }, [])

  const updateListing = useCallback((listingId: string, input: Partial<NewListingInput>) => {
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...input } : l)))
    void supabase.from('listings').update(toListingRow(input)).eq('id', listingId).then(({ error }) => {
      if (error) console.error('Could not update listing in Supabase:', error.message)
    })
  }, [])

  const updateListingStatus = useCallback(
    (listingId: string, status: import('./types').ListingStatus) => {
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status } : l)),
      )
    },
    [],
  )

  const toggleFavorite = useCallback((listingId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      next.has(listingId) ? next.delete(listingId) : next.add(listingId)
      return next
    })
  }, [])

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      currentUserId: CURRENT_USER_ID,
      listings,
      needs,
      threads,
      rentals,
      addListing,
      addNeed,
      getThreadForListing,
      startThread,
      sendMessage,
      receiveMessage,
      startRental,
      setRentalPhase,
      deleteListing,
      updateListing,
      updateListingStatus,
      favoriteIds,
      toggleFavorite,
      isAuthenticated,
      login,
      logout,
    }),
    [
      listings,
      needs,
      threads,
      rentals,
      addListing,
      addNeed,
      getThreadForListing,
      startThread,
      sendMessage,
      receiveMessage,
      startRental,
      setRentalPhase,
      deleteListing,
      updateListing,
      updateListingStatus,
      favoriteIds,
      toggleFavorite,
      isAuthenticated,
      login,
      logout,
    ],
  )

  return (
    <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>
  )
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext)
  if (!ctx) throw new Error('useMarketplace must be used within MarketplaceProvider')
  return ctx
}
