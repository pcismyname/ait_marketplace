'use client'

// App-wide marketplace state backed by Supabase.
//
// - Public data (listings, item history, reviews) loads for everyone.
// - Private data (needs, chats, rentals, purchases, favorites, profiles)
//   loads for the signed-in user only, filtered by RLS.
// - There is no mock identity: logged-out users have currentUserId = null and
//   every write that needs a user throws "Log in to continue".
// - Rentals and sales change state only through the RPC wrappers in lib/api
//   (docs/Database.md). Realtime keeps chats, rentals and purchases fresh.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { BRAND, sampleUser } from './data'
import type { SalePaymentMode } from './fees'
import { createClient } from '@/utils/supabase/client'
import type { TablesInsert, TablesUpdate } from './database.types'
import * as api from './api'
import { maybeRunEscrowJobs } from './escrow-runner'
import { ApiError, toApiError } from './api/client'
import { LISTING_COLUMNS, mapListing, mapRental, mapTransaction, mapUser } from './api/mappers'
import type {
  CategoryId,
  Listing,
  ListingStatus,
  ListingType,
  Condition,
  Need,
  PaymentMethod,
  Rental,
  Thread,
  Transaction,
  User,
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
  /** When premium placement ends; null clears it. */
  featuredUntil?: string | null
  /** Owner's replacement-value estimate (BusinessRules §3); null clears it. */
  replacementValue?: number | null
}

interface NewNeedInput {
  title: string
  category: CategoryId
  note: string
  arrivalDate: string
}

interface MarketplaceContextValue {
  /** Signed-in user's id, or null when logged out. */
  currentUserId: string | null
  /** Signed-in user's profile (null while loading or logged out). */
  currentUser: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** True until the first load after the auth state is known. */
  loading: boolean
  listings: Listing[]
  needs: Need[]
  threads: Thread[]
  /** Rentals where the user is the renter or the owner. */
  rentals: Rental[]
  /** Purchases and sales where the user is the buyer or the seller. */
  transactions: Transaction[]
  /** Profile by id, with a neutral placeholder for unknown ids. */
  getUser: (id: string | null | undefined) => User
  /** Reload everything from the database (also runs the escrow jobs). */
  refresh: () => Promise<void>

  /** Optimistic; resolves once saved, or rolls back and throws ApiError. */
  addListing: (input: NewListingInput) => Promise<Listing>
  /** Optimistic; resolves once saved, or reloads the row and throws ApiError. */
  updateListing: (listingId: string, input: Partial<NewListingInput>) => Promise<void>
  /** 'sold' on a sale listing goes through mark_sold (in-person sale record). Throws ApiError. */
  updateListingStatus: (listingId: string, status: ListingStatus, buyerId?: string) => Promise<void>
  /** Throws ApiError (e.g. a listing with rental or sale history can't be deleted). */
  deleteListing: (listingId: string) => Promise<void>
  addNeed: (input: NewNeedInput) => Need

  getThreadForListing: (listingId: string) => Thread | undefined
  startThread: (listingId: string, otherUserId: string, firstMessage: string) => Thread
  sendMessage: (threadId: string, text: string) => void
  /** Local-only message (used by the chat page's simulated reply). */
  receiveMessage: (threadId: string, senderId: string, text: string) => void

  // Rentals (BusinessRules §4) — each resolves with the updated rental or throws ApiError.
  requestRental: (listingId: string, message?: string) => Promise<Rental>
  respondRental: (rentalId: string, approve: boolean, reason?: string) => Promise<Rental>
  cancelRental: (rentalId: string, reason?: string) => Promise<Rental>
  payRental: (rentalId: string, method: PaymentMethod) => Promise<Rental>
  confirmHandover: (rentalId: string, photos?: string[]) => Promise<Rental>
  markReturned: (rentalId: string, photos?: string[]) => Promise<Rental>
  confirmReturn: (rentalId: string, photos?: string[]) => Promise<Rental>

  // Sales (BusinessRules §5)
  createSale: (listingId: string, mode: SalePaymentMode, method?: PaymentMethod) => Promise<Transaction>
  markSold: (listingId: string, buyerId?: string) => Promise<Transaction>

  favoriteIds: Set<string>
  toggleFavorite: (listingId: string) => void
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null)
const supabase = createClient()

const PLACEHOLDER_USER: Omit<User, 'id'> = {
  name: 'AIT member',
  avatar: '',
  program: '',
  batch: '',
  rating: 0,
  reviewsCount: 0,
  joined: '',
  kind: 'student',
}

const nextId = () => crypto.randomUUID()

function notifyError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${action}:`, message)
  toast.error(action, { description: message })
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id)
  if (index === -1) return [item, ...list]
  const next = list.slice()
  next[index] = item
  return next
}

function toListingInsert(listing: Listing): TablesInsert<'listings'> {
  return {
    id: listing.id,
    seller_id: listing.sellerId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    type: listing.type,
    price: listing.price,
    deposit: listing.deposit ?? null,
    rental_period: listing.rentalPeriod ?? null,
    condition: listing.condition,
    images: listing.images,
    pickup_location: listing.pickupLocation,
    status: listing.status,
    featured: listing.featured ?? false,
    featured_until: listing.featuredUntil ?? null,
    replacement_value: listing.replacementValue ?? null,
    created_at: listing.createdAt,
  }
}

function toListingUpdate(input: Partial<NewListingInput>): TablesUpdate<'listings'> {
  const row: TablesUpdate<'listings'> = {}
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
  if (input.featured !== undefined) row.featured = input.featured
  if (input.featuredUntil !== undefined) row.featured_until = input.featuredUntil
  if (input.replacementValue !== undefined) row.replacement_value = input.replacementValue
  return row
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([])
  const [needs, setNeeds] = useState<Need[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profiles, setProfiles] = useState<Map<string, User>>(new Map())
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const isAuthenticated = currentUserId !== null

  const requireUser = useCallback((): string => {
    const uid = userIdRef.current
    if (!uid) throw new ApiError('Log in to continue.', '28000')
    return uid
  }, [])

  const reloadListing = useCallback(async (listingId: string) => {
    const { data } = await supabase.from('listings').select(LISTING_COLUMNS).eq('id', listingId).maybeSingle()
    setListings((prev) => {
      const existing = prev.find((l) => l.id === listingId)
      if (!data) return prev.filter((l) => l.id !== listingId)
      const fresh = mapListing(data)
      return upsertById(prev, existing ? { ...fresh, history: existing.history, reviews: existing.reviews } : fresh)
    })
  }, [])

  const loadThreads = useCallback(async () => {
    const [{ data: remoteThreads }, { data: remoteMessages }, { data: participants }] = await Promise.all([
      supabase.from('threads').select('*').order('created_at', { ascending: false }),
      supabase.from('messages').select('*').order('created_at', { ascending: true }),
      supabase.from('thread_participants').select('*'),
    ])
    if (!remoteThreads || !remoteMessages || !participants) return
    setThreads(remoteThreads.map((thread) => ({
      id: thread.id,
      listingId: thread.listing_id,
      participantIds: participants.filter((p) => p.thread_id === thread.id).map((p) => p.user_id),
      messages: remoteMessages
        .filter((m) => m.thread_id === thread.id)
        .map((m) => ({ id: m.id, senderId: m.sender_id, text: m.text, createdAt: m.created_at ?? '' })),
    })))
  }, [])

  const loadAll = useCallback(async (uid: string | null) => {
    if (uid) {
      // Lazy escrow work (payouts, auto-release, overdue) so a demo never waits for pg_cron.
      // Shared throttle (lib/escrow-runner.ts): skipped if the jobs ran in the last 20 s.
      await maybeRunEscrowJobs()
    }
    const [listingsRes, historyRes, reviewsRes] = await Promise.all([
      supabase.from('listings').select(LISTING_COLUMNS).order('created_at', { ascending: false }),
      supabase.from('listing_history').select('*').order('created_at', { ascending: true }),
      supabase.from('reviews').select('*').order('created_at', { ascending: true }),
    ])
    for (const res of [listingsRes, historyRes, reviewsRes]) {
      if (res.error) console.error('Could not load marketplace data from Supabase:', res.error.message)
    }
    if (listingsRes.data) {
      const history = historyRes.data ?? []
      const reviews = reviewsRes.data ?? []
      setListings(listingsRes.data.map((row) => ({
        ...mapListing(row),
        history: history
          .filter((h) => h.listing_id === row.id)
          .map((h) => ({ ownerName: h.owner_name, action: h.action, date: h.date })),
        reviews: reviews
          .filter((r) => r.listing_id === row.id)
          .map((r) => ({
            id: r.id,
            authorName: r.author_name,
            authorAvatar: r.author_avatar ?? '',
            role: r.role as 'buyer' | 'seller' | 'renter',
            rating: Number(r.rating ?? 0),
            comment: r.comment ?? '',
            date: r.date,
          })),
      })))
    }

    if (!uid) {
      setNeeds([])
      setThreads([])
      setRentals([])
      setTransactions([])
      setFavoriteIds(new Set())
      setProfiles(new Map())
      return
    }

    const [usersRes, needsRes, rentalsRes, txRes, favoritesRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('needs').select('*').order('created_at', { ascending: false }),
      supabase.from('rentals').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('favorites').select('listing_id'),
      loadThreads(),
    ])
    for (const res of [usersRes, needsRes, rentalsRes, txRes, favoritesRes]) {
      if (res.error) console.error('Could not load marketplace data from Supabase:', res.error.message)
    }
    if (usersRes.data) setProfiles(new Map(usersRes.data.map((row) => [row.id, mapUser(row)])))
    if (needsRes.data) {
      setNeeds(needsRes.data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        category: row.category as CategoryId,
        note: row.note ?? '',
        arrivalDate: row.arrival_date,
        createdAt: row.created_at ?? new Date().toISOString(),
      })))
    }
    if (rentalsRes.data) setRentals(rentalsRes.data.map(mapRental))
    if (txRes.data) setTransactions(txRes.data.map(mapTransaction))
    if (favoritesRes.data) setFavoriteIds(new Set(favoritesRes.data.map((f) => f.listing_id)))
  }, [loadThreads])

  // Auth: INITIAL_SESSION fires once on mount, then SIGNED_IN / SIGNED_OUT.
  useEffect(() => {
    let cancelled = false
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user.id ?? null
      const changed = uid !== userIdRef.current
      userIdRef.current = uid
      setCurrentUserId(uid)
      if (event === 'INITIAL_SESSION' || changed) {
        // Don't await Supabase calls inside this callback (supabase-js deadlock); defer.
        setTimeout(() => {
          void loadAll(uid).finally(() => {
            if (!cancelled) setLoading(false)
          })
        }, 0)
      }
    })
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [loadAll])

  // Realtime: chat messages, rentals and purchases for the signed-in user.
  useEffect(() => {
    if (!currentUserId) return
    const unsubscribers = [
      api.subscribeToMessages((threadId, message) => {
        let known = false
        setThreads((prev) => prev.map((t) => {
          if (t.id !== threadId) return t
          known = true
          if (t.messages.some((m) => m.id === message.id)) return t
          return { ...t, messages: [...t.messages, message] }
        }))
        if (!known) void loadThreads()
      }),
      api.subscribeToRentals((rental) => {
        setRentals((prev) => upsertById(prev, rental))
        void reloadListing(rental.listingId)
      }),
      api.subscribeToTransactions((tx) => {
        setTransactions((prev) => upsertById(prev, tx))
        void reloadListing(tx.listingId)
      }),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [currentUserId, loadThreads, reloadListing])

  const refresh = useCallback(() => loadAll(userIdRef.current), [loadAll])

  const getUser = useCallback(
    (id: string | null | undefined): User => {
      if (!id) return { id: '', ...PLACEHOLDER_USER }
      return profiles.get(id) ?? sampleUser(id) ?? { id, ...PLACEHOLDER_USER }
    },
    [profiles],
  )

  const currentUser = currentUserId ? profiles.get(currentUserId) ?? null : null
  const isAdmin = Boolean(currentUser?.isAdmin)

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Could not log out from Supabase:', error.message)
  }, [])

  // ─── Listings ──────────────────────────────────────────────────────────────

  const addListing = useCallback(async (input: NewListingInput): Promise<Listing> => {
    const uid = requireUser()
    const me = getUser(uid)
    const listing: Listing = {
      id: nextId(),
      ...input,
      featuredUntil: input.featuredUntil ?? undefined,
      replacementValue: input.replacementValue ?? undefined,
      sellerId: uid,
      createdAt: new Date().toISOString(),
      status: 'available',
      timesChangedHands: 1,
      history: [{ ownerName: me.name, action: `Listed on ${BRAND}`, date: 'Just now' }],
      reviews: [],
    }
    setListings((prev) => [listing, ...prev])
    const { error } = await supabase.from('listings').insert(toListingInsert(listing))
    if (error) {
      setListings((prev) => prev.filter((l) => l.id !== listing.id))
      throw toApiError(error)
    }
    await supabase.from('listing_history').insert({
      listing_id: listing.id,
      owner_name: me.name,
      action: `Listed on ${BRAND}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    })
    return listing
  }, [getUser, requireUser])

  const updateListing = useCallback(async (listingId: string, input: Partial<NewListingInput>) => {
    const { featuredUntil, replacementValue, ...rest } = input
    setListings((prev) => prev.map((l) => (l.id === listingId
      ? {
          ...l,
          ...rest,
          ...(featuredUntil !== undefined ? { featuredUntil: featuredUntil ?? undefined } : {}),
          ...(replacementValue !== undefined ? { replacementValue: replacementValue ?? undefined } : {}),
        }
      : l)))
    const { error } = await supabase.from('listings').update(toListingUpdate(input)).eq('id', listingId)
    await reloadListing(listingId)
    if (error) throw toApiError(error)
  }, [reloadListing])

  const updateListingStatus = useCallback(async (listingId: string, status: ListingStatus, buyerId?: string) => {
    const listing = listings.find((l) => l.id === listingId)
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status } : l)))
    try {
      if (status === 'sold' && listing?.type === 'sale') {
        const tx = await api.markSold(listingId, buyerId)
        setTransactions((prev) => upsertById(prev, tx))
        // mark_sold cancels the other pending purchases: refresh them too.
        const { data } = await supabase.from('transactions').select('*').eq('listing_id', listingId)
        if (data) setTransactions((prev) => data.map(mapTransaction).reduce(upsertById, prev))
        return
      }
      const { error } = await supabase.from('listings').update({ status }).eq('id', listingId)
      if (error) throw toApiError(error)
    } finally {
      await reloadListing(listingId)
    }
  }, [listings, reloadListing])

  const deleteListing = useCallback(async (listingId: string) => {
    const { data, error } = await supabase.from('listings').delete().eq('id', listingId).select('id')
    if (error) throw toApiError(error)
    if (!data || data.length === 0) throw new ApiError("You can't delete this listing.")
    setListings((prev) => prev.filter((l) => l.id !== listingId))
  }, [])

  // ─── Needs ─────────────────────────────────────────────────────────────────

  const addNeed = useCallback((input: NewNeedInput): Need => {
    const uid = requireUser()
    const need: Need = { id: nextId(), userId: uid, ...input, createdAt: new Date().toISOString() }
    setNeeds((prev) => [need, ...prev])
    void supabase.from('needs').insert({
      id: need.id,
      user_id: uid,
      title: need.title,
      category: need.category,
      note: need.note,
      arrival_date: need.arrivalDate,
      created_at: need.createdAt,
    }).then(({ error }) => {
      if (error) {
        setNeeds((prev) => prev.filter((n) => n.id !== need.id))
        notifyError('Could not save your request', error)
      }
    })
    return need
  }, [requireUser])

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const getThreadForListing = useCallback(
    (listingId: string) =>
      currentUserId
        ? threads.find((t) => t.listingId === listingId && t.participantIds.includes(currentUserId))
        : undefined,
    [threads, currentUserId],
  )

  const startThread = useCallback(
    (listingId: string, otherUserId: string, firstMessage: string): Thread => {
      const uid = requireUser()
      const existing = threads.find(
        (t) => t.listingId === listingId && t.participantIds.includes(uid) && t.participantIds.includes(otherUserId),
      )
      const msg = { id: nextId(), senderId: uid, text: firstMessage, createdAt: new Date().toISOString() }
      const thread: Thread = existing
        ? { ...existing, messages: [...existing.messages, msg] }
        : { id: nextId(), listingId, participantIds: [uid, otherUserId], messages: [msg] }
      setThreads((prev) => (existing ? prev.map((t) => (t.id === thread.id ? thread : t)) : [thread, ...prev]))
      api.startThread(listingId, otherUserId, firstMessage, { threadId: thread.id, messageId: msg.id }).then(
        ({ threadId }) => {
          // The server reused a thread we didn't have locally: reload.
          if (threadId !== thread.id) void loadThreads()
        },
        (error) => {
          notifyError('Could not send the message', error)
          void loadThreads()
        },
      )
      return thread
    },
    [threads, requireUser, loadThreads],
  )

  const sendMessage = useCallback((threadId: string, text: string) => {
    const uid = requireUser()
    const msg = { id: nextId(), senderId: uid, text, createdAt: new Date().toISOString() }
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t)),
    )
    api.sendMessage(threadId, text, msg.id).catch((error) => notifyError('Could not send the message', error))
  }, [requireUser])

  const receiveMessage = useCallback((threadId: string, senderId: string, text: string) => {
    const msg = { id: nextId(), senderId, text, createdAt: new Date().toISOString() }
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t)),
    )
  }, [])

  // ─── Rentals & sales (RPCs) ────────────────────────────────────────────────

  const applyRental = useCallback(async (promise: Promise<Rental>): Promise<Rental> => {
    const rental = await promise
    setRentals((prev) => upsertById(prev, rental))
    void reloadListing(rental.listingId)
    return rental
  }, [reloadListing])

  const applyTransaction = useCallback(async (promise: Promise<Transaction>): Promise<Transaction> => {
    const tx = await promise
    setTransactions((prev) => upsertById(prev, tx))
    void reloadListing(tx.listingId)
    return tx
  }, [reloadListing])

  const requestRental = useCallback(
    (listingId: string, message?: string) => applyRental(api.requestRental(listingId, message)),
    [applyRental],
  )
  const respondRental = useCallback(
    (rentalId: string, approve: boolean, reason?: string) => applyRental(api.respondRental(rentalId, approve, reason)),
    [applyRental],
  )
  const cancelRental = useCallback(
    (rentalId: string, reason?: string) => applyRental(api.cancelRental(rentalId, reason)),
    [applyRental],
  )
  const payRental = useCallback(
    (rentalId: string, method: PaymentMethod) => applyRental(api.payRental(rentalId, method)),
    [applyRental],
  )
  const confirmHandover = useCallback(
    (rentalId: string, photos?: string[]) => applyRental(api.confirmHandover(rentalId, photos)),
    [applyRental],
  )
  const markReturned = useCallback(
    (rentalId: string, photos?: string[]) => applyRental(api.markReturned(rentalId, photos)),
    [applyRental],
  )
  const confirmReturn = useCallback(
    (rentalId: string, photos?: string[]) => applyRental(api.confirmReturn(rentalId, photos)),
    [applyRental],
  )
  const createSale = useCallback(
    (listingId: string, mode: SalePaymentMode, method?: PaymentMethod) =>
      applyTransaction(api.createSale(listingId, mode, method)),
    [applyTransaction],
  )
  const markSold = useCallback(
    (listingId: string, buyerId?: string) => applyTransaction(api.markSold(listingId, buyerId)),
    [applyTransaction],
  )

  // ─── Favorites ─────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback((listingId: string) => {
    const uid = userIdRef.current
    if (!uid) {
      toast.error('Log in to save favorites')
      return
    }
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      const removing = next.has(listingId)
      if (removing) next.delete(listingId)
      else next.add(listingId)
      void (removing
        ? supabase.from('favorites').delete().eq('user_id', uid).eq('listing_id', listingId)
        : supabase.from('favorites').insert({ user_id: uid, listing_id: listingId })
      ).then(({ error }) => {
        if (error) console.error('Could not update favorite in Supabase:', error.message)
      })
      return next
    })
  }, [])

  const value = useMemo<MarketplaceContextValue>(
    () => ({
      currentUserId,
      currentUser,
      isAuthenticated,
      isAdmin,
      loading,
      listings,
      needs,
      threads,
      rentals,
      transactions,
      getUser,
      refresh,
      addListing,
      updateListing,
      updateListingStatus,
      deleteListing,
      addNeed,
      getThreadForListing,
      startThread,
      sendMessage,
      receiveMessage,
      requestRental,
      respondRental,
      cancelRental,
      payRental,
      confirmHandover,
      markReturned,
      confirmReturn,
      createSale,
      markSold,
      favoriteIds,
      toggleFavorite,
      login,
      logout,
    }),
    [
      currentUserId, currentUser, isAuthenticated, isAdmin, loading, listings, needs, threads, rentals,
      transactions, getUser, refresh, addListing, updateListing, updateListingStatus, deleteListing, addNeed,
      getThreadForListing, startThread, sendMessage, receiveMessage, requestRental, respondRental, cancelRental,
      payRental, confirmHandover, markReturned, confirmReturn, createSale, markSold, favoriteIds, toggleFavorite,
      login, logout,
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
