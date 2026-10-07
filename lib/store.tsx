'use client'

import {
  createContext,
  useCallback,
  useContext,
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
  updateListingStatus: (listingId: string, status: import('./types').ListingStatus) => void
  favoriteIds: Set<string>
  toggleFavorite: (listingId: string) => void
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null)

let idCounter = 1000
const nextId = (prefix: string) => `${prefix}_${++idCounter}`

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(LISTINGS)
  const [needs, setNeeds] = useState<Need[]>(NEEDS)
  const [threads, setThreads] = useState<Thread[]>(THREADS)
  const [rentals, setRentals] = useState<Rental[]>(RENTALS)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

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
        return existing
      }
      const thread: Thread = {
        id: nextId('t'),
        listingId,
        participantIds: [CURRENT_USER_ID, sellerId],
        messages: [
          {
            id: nextId('m'),
            senderId: CURRENT_USER_ID,
            text: firstMessage,
            createdAt: new Date().toISOString(),
          },
        ],
      }
      setThreads((prev) => [thread, ...prev])
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
  }, [])

  const deleteListing = useCallback((listingId: string) => {
    setListings((prev) => prev.filter((l) => l.id !== listingId))
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
      updateListingStatus,
      favoriteIds,
      toggleFavorite,
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
      updateListingStatus,
      favoriteIds,
      toggleFavorite,
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
