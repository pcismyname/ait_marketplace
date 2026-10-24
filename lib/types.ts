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
  email?: string
  avatar: string
  program: string
  batch: string
  rating: number
  reviewsCount: number
  joined: string
  /** Defaults to 'student' when omitted. */
  kind?: UserKind
  /** Platform admin (resolves disputes). Set in the database only. */
  isAdmin?: boolean
  pickupLocation?: string
  arrivalDate?: string
  departureDate?: string
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

/**
 * Rental states from docs/BusinessRules.md §4 (persisted in rentals.phase):
 *   requested → approved → paid (deposit held) → active
 *   requested → declined (owner says no) · requested / approved → cancelled
 *   active → return-pending → released
 *   active → return-pending → disputed → resolved
 *   active → overdue → missing (7+ days late, deposit to owner)
 * Transitions happen only through the RPCs in lib/api/rentals.ts.
 */
export type RentalPhase =
  | 'requested'
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'paid'
  | 'active'
  | 'return-pending'
  | 'released'
  | 'disputed'
  | 'resolved'
  | 'overdue'
  | 'missing'

export type PaymentMethod = 'promptpay' | 'card' | 'wallet'

export interface Rental {
  id: string
  listingId: string
  renterId: string
  ownerId: string
  /** Refundable deposit held in escrow (THB). */
  deposit: number
  /** Provisional until handover, then the handover time. */
  startDate: string
  /** Provisional until handover, then handover + one rental period. */
  dueDate: string
  phase: RentalPhase
  /** Fee breakdown (lib/fees.ts RentalQuote), computed by the server. */
  quote?: RentalQuote
  paymentMethod?: PaymentMethod
  rentalPeriod?: string
  periodDays: number
  rentalFee: number
  commission: number
  escrowFee: number
  /** What the renter paid at booking (set when paid). */
  totalPaid?: number
  requestMessage?: string
  declineReason?: string
  requestedAt: string
  approvedAt?: string
  declinedAt?: string
  cancelledAt?: string
  paidAt?: string
  handoverAt?: string
  /** When the owner's rental fee is due (handover + 48 h). */
  payoutAt?: string
  payoutReleasedAt?: string
  overdueAt?: string
  returnedAt?: string
  /** Return + 48 h: last moment to open a dispute. */
  disputeWindowEndsAt?: string
  /** When the deposit was settled (released, resolved or missing). */
  releasedAt?: string
  lateDays: number
  /** Late fee taken from the deposit, fixed at the return. */
  lateFee: number
  depositToOwner?: number
  depositToRenter?: number
  /** dispute-evidence storage paths. */
  handoverPhotos: string[]
  returnPhotos: string[]
}

/** How a sale is paid (BusinessRules §5). Same values as lib/fees.ts. */
export type SaleMode = 'in-person' | 'protected'

/**
 * Sale states (persisted in transactions.status):
 *   in person:  pending → completed (seller marks it sold) · pending → cancelled
 *   protected:  paid (held) → handed-over → released (48 h, or buyer confirms)
 *               handed-over → disputed → resolved
 */
export type SaleStatus =
  | 'pending'
  | 'paid'
  | 'handed-over'
  | 'disputed'
  | 'released'
  | 'resolved'
  | 'completed'
  | 'cancelled'

export interface Transaction {
  id: string
  listingId: string
  /** Null only for in-person sales recorded without a buyer. */
  buyerId?: string
  sellerId: string
  mode: SaleMode
  price: number
  protectionFee: number
  total: number
  paymentMethod?: PaymentMethod
  status: SaleStatus
  refundToBuyer: number
  sellerAmount?: number
  handoverPhotos: string[]
  createdAt: string
  paidAt?: string
  handoverAt?: string
  disputeWindowEndsAt?: string
  releasedAt?: string
  completedAt?: string
  cancelledAt?: string
}

export type DisputeFinding = 'normal-wear' | 'repairable-damage' | 'lost-or-destroyed' | 'not-as-described'

export type DisputeStatus = 'open' | 'resolved'

export interface Dispute {
  id: string
  rentalId?: string
  transactionId?: string
  filedBy: string
  againstId: string
  reason: string
  description: string
  /** dispute-evidence storage paths. */
  evidence: string[]
  claimAmount?: number
  status: DisputeStatus
  finding?: DisputeFinding
  resolutionAmount?: number
  depositToOwner?: number
  depositToRenter?: number
  refundToBuyer?: number
  sellerAmount?: number
  resolutionNote?: string
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
}

export interface DisputeComment {
  id: string
  disputeId: string
  authorId: string
  body: string
  attachments: string[]
  createdAt: string
}

export type LedgerKind =
  | 'payment'
  | 'hold'
  | 'hold_release'
  | 'payout'
  | 'refund'
  | 'claim'
  | 'platform_fee'
  | 'withdrawal'

/** held: kept by the platform for you · available: your wallet · external: paid in by PromptPay / card. */
export type LedgerBucket = 'held' | 'available' | 'external' | 'platform'

export interface LedgerEntry {
  id: string
  kind: LedgerKind
  bucket: LedgerBucket
  /** Signed: + credits the bucket, − debits it. */
  amount: number
  memo: string
  paymentMethod?: PaymentMethod
  rentalId?: string
  transactionId?: string
  disputeId?: string
  createdAt: string
}

export interface WalletSummary {
  /** Everything the platform holds for you (deposits + payouts not yet released). */
  held: number
  /** In-app wallet balance (refunds, payouts). Can pay with method 'wallet'. */
  available: number
  /** Part of `held`: rental fees and sale payments waiting to be paid out to you. */
  pendingPayouts: number
  /** Part of `held`: your rental deposits in escrow. */
  depositsHeld: number
}

/** In-app notification. Named AppNotification to avoid the DOM Notification type. */
export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string
  link?: string
  readAt?: string
  createdAt: string
}
