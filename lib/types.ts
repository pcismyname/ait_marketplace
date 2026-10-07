import type { RentalQuote } from './fees'

export type CategoryId =
  | 'furniture'
  | 'electronics'
  | 'bicycles'
  | 'textbooks'
  | 'kitchen'
  | 'sports'
  | 'other'

export type ListingType = 'sale' | 'rent'

export type Condition = 'new' | 'like-new' | 'good' | 'fair'

export type ListingStatus = 'available' | 'reserved' | 'sold' | 'rented' | 'paused'

/**
 * Students are the core of the community. Campus shops are the "B" in
 * C2B2C: partner outlets that list new stock and rental fleets next to
 * student listings, under the same escrow rules.
 */
export type UserKind = 'student' | 'shop'

export interface Category {
  id: CategoryId
  label: string
  blurb: string
}

export interface User {
  id: string
  name: string
  avatar: string
  program: string
  batch: string
  rating: number
  reviewsCount: number
  joined: string
  /** Defaults to 'student' when omitted. */
  kind?: UserKind
}

export interface HistoryEvent {
  ownerName: string
  action: string
  date: string
}

export interface Review {
  id: string
  authorName: string
  authorAvatar: string
  role: 'buyer' | 'seller' | 'renter'
  rating: number
  comment: string
  date: string
}

export interface Listing {
  id: string
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
  sellerId: string
  createdAt: string
  status: ListingStatus
  timesChangedHands: number
  history: HistoryEvent[]
  reviews: Review[]
  /** Premium placement: shown first in search and matching. */
  featured?: boolean
  /** Light stat surfaced in My Listings. */
  viewCount?: number
}

export interface Need {
  id: string
  userId: string
  title: string
  category: CategoryId
  note: string
  arrivalDate: string
  createdAt: string
}

export interface Message {
  id: string
  senderId: string
  text: string
  createdAt: string
}

export interface Thread {
  id: string
  listingId: string
  participantIds: string[]
  messages: Message[]
}

export type RentalPhase = 'active' | 'return-pending' | 'released' | 'disputed'

export type PaymentMethod = 'promptpay' | 'card' | 'wallet'

export interface Rental {
  id: string
  listingId: string
  renterId: string
  deposit: number
  startDate: string
  dueDate: string
  phase: RentalPhase
  /** Fee breakdown paid at booking. Seed rentals predate checkout and omit it. */
  quote?: RentalQuote
  paymentMethod?: PaymentMethod
}
