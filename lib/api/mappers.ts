// Database rows (snake_case, lib/database.types.ts) → app types (camelCase,
// lib/types.ts). Pure functions: safe to import anywhere, including tests.

import type { Tables } from '../database.types'
import type { RentalQuote } from '../fees'
import type {
  AppNotification,
  CategoryId,
  Condition,
  Dispute,
  DisputeComment,
  DisputeFinding,
  LedgerBucket,
  LedgerEntry,
  Listing,
  ListingStatus,
  ListingType,
  PaymentMethod,
  Rental,
  RentalPhase,
  SaleMode,
  SaleStatus,
  Transaction,
  User,
  UserKind,
  LedgerKind,
} from '../types'

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value)
const num = (value: number | null | undefined, fallback = 0): number =>
  value === null || value === undefined ? fallback : Number(value)
const optNum = (value: number | null | undefined): number | undefined =>
  value === null || value === undefined ? undefined : Number(value)

export type ListingRow = Tables<'listings'>
export type RentalRow = Tables<'rentals'>
export type TransactionRow = Tables<'transactions'>
export type DisputeRow = Tables<'disputes'>
export type DisputeCommentRow = Tables<'dispute_comments'>
export type LedgerRow = Tables<'wallet_ledger'>
export type NotificationRow = Tables<'notifications'>
export type UserRow = Tables<'users'>

/** Columns the app reads from listings (everything except the search vector). */
/** Admin moderation columns (20261025020300_admin_moderation.sql); read by lib/api/moderation.ts only. */
type ListingModerationColumn = 'hidden_at' | 'hidden_by' | 'hidden_reason'

export const LISTING_COLUMNS =
  'id, seller_id, title, description, category, type, price, deposit, rental_period, condition, images, pickup_location, status, times_changed_hands, featured, featured_until, view_count, replacement_value, created_at, updated_at'

export function mapListing(
  row: Omit<ListingRow, 'search' | 'is_featured' | ListingModerationColumn> & {
    search?: unknown
    is_featured?: boolean | null
  } & Partial<Pick<ListingRow, ListingModerationColumn>>,
): Listing {
  // Premium placement counts only until featured_until (public.is_featured).
  const featuredActive = Boolean(row.featured) && (!row.featured_until || new Date(row.featured_until) > new Date())
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as CategoryId,
    type: row.type as ListingType,
    price: Number(row.price ?? 0),
    deposit: optNum(row.deposit),
    rentalPeriod: opt(row.rental_period),
    condition: row.condition as Condition,
    images: Array.isArray(row.images) && row.images.length > 0 ? row.images.map(String) : ['/placeholder.svg'],
    pickupLocation: row.pickup_location,
    sellerId: row.seller_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    status: row.status as ListingStatus,
    timesChangedHands: Number(row.times_changed_hands ?? 0),
    featured: row.is_featured ?? featuredActive,
    featuredUntil: opt(row.featured_until),
    replacementValue: optNum(row.replacement_value),
    viewCount: optNum(row.view_count),
    history: [],
    reviews: [],
  }
}

export function mapRental(row: RentalRow): Rental {
  return {
    id: row.id,
    listingId: row.listing_id,
    renterId: row.renter_id,
    ownerId: row.owner_id,
    deposit: Number(row.deposit),
    startDate: row.start_date,
    dueDate: row.due_date,
    phase: row.phase as RentalPhase,
    quote: (row.quote ?? undefined) as RentalQuote | undefined,
    paymentMethod: opt(row.payment_method) as PaymentMethod | undefined,
    rentalPeriod: opt(row.rental_period),
    periodDays: num(row.period_days, 120),
    rentalFee: num(row.rental_fee),
    commission: num(row.commission),
    escrowFee: num(row.escrow_fee),
    totalPaid: optNum(row.total_paid),
    requestMessage: opt(row.request_message),
    declineReason: opt(row.decline_reason),
    requestedAt: row.requested_at,
    approvedAt: opt(row.approved_at),
    declinedAt: opt(row.declined_at),
    cancelledAt: opt(row.cancelled_at),
    paidAt: opt(row.paid_at),
    handoverAt: opt(row.handover_at),
    payoutAt: opt(row.payout_at),
    payoutReleasedAt: opt(row.payout_released_at),
    overdueAt: opt(row.overdue_at),
    returnedAt: opt(row.returned_at),
    disputeWindowEndsAt: opt(row.dispute_window_ends_at),
    releasedAt: opt(row.released_at),
    lateDays: num(row.late_days),
    lateFee: num(row.late_fee),
    depositToOwner: optNum(row.deposit_to_owner),
    depositToRenter: optNum(row.deposit_to_renter),
    handoverPhotos: row.handover_photos ?? [],
    returnPhotos: row.return_photos ?? [],
  }
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: opt(row.buyer_id),
    sellerId: row.seller_id,
    mode: row.mode as SaleMode,
    price: Number(row.price),
    protectionFee: Number(row.protection_fee),
    total: Number(row.total),
    sellerCommission: Number(row.seller_commission ?? 0),
    paymentMethod: opt(row.payment_method) as PaymentMethod | undefined,
    status: row.status as SaleStatus,
    refundToBuyer: Number(row.refund_to_buyer),
    sellerAmount: optNum(row.seller_amount),
    handoverPhotos: row.handover_photos ?? [],
    createdAt: row.created_at,
    paidAt: opt(row.paid_at),
    handoverAt: opt(row.handover_at),
    disputeWindowEndsAt: opt(row.dispute_window_ends_at),
    releasedAt: opt(row.released_at),
    completedAt: opt(row.completed_at),
    cancelledAt: opt(row.cancelled_at),
  }
}

export function mapDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    rentalId: opt(row.rental_id),
    transactionId: opt(row.transaction_id),
    filedBy: row.filed_by,
    againstId: row.against_id,
    reason: row.reason,
    description: row.description,
    evidence: row.evidence ?? [],
    claimAmount: optNum(row.claim_amount),
    status: row.status as Dispute['status'],
    finding: opt(row.finding) as DisputeFinding | undefined,
    resolutionAmount: optNum(row.resolution_amount),
    depositToOwner: optNum(row.deposit_to_owner),
    depositToRenter: optNum(row.deposit_to_renter),
    refundToBuyer: optNum(row.refund_to_buyer),
    sellerAmount: optNum(row.seller_amount),
    resolutionNote: opt(row.resolution_note),
    resolvedBy: opt(row.resolved_by),
    resolvedAt: opt(row.resolved_at),
    createdAt: row.created_at,
  }
}

export function mapDisputeComment(row: DisputeCommentRow): DisputeComment {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    authorId: row.author_id,
    body: row.body,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  }
}

export function mapLedgerEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    kind: row.kind as LedgerKind,
    bucket: row.bucket as LedgerBucket,
    amount: Number(row.amount),
    memo: row.memo,
    paymentMethod: opt(row.payment_method) as PaymentMethod | undefined,
    rentalId: opt(row.rental_id),
    transactionId: opt(row.transaction_id),
    disputeId: opt(row.dispute_id),
    createdAt: row.created_at,
  }
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: opt(row.link),
    readAt: opt(row.read_at),
    createdAt: row.created_at,
  }
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: opt(row.email),
    avatar: row.avatar ?? '',
    program: row.program ?? '',
    batch: row.batch ?? '',
    rating: Number(row.rating ?? 0),
    reviewsCount: Number(row.reviews_count ?? 0),
    joined: row.joined ? String(new Date(row.joined).getFullYear()) : '',
    kind: (row.kind as UserKind) ?? 'student',
    isAdmin: Boolean(row.is_admin),
    pickupLocation: opt(row.pickup_location),
    arrivalDate: opt(row.arrival_date),
    departureDate: opt(row.departure_date),
  }
}
