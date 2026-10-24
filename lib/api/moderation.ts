// Admin moderation and dashboard counters
// (supabase/migrations/20261025020300_admin_moderation.sql). Admin only; the
// RPCs check is_admin(). Import from '@/lib/api/moderation'.

import type { Listing, User } from '../types'
import { db, unwrap } from './client'
import { LISTING_COLUMNS, mapListing, mapUser } from './mappers'

export interface AdminStats {
  users: number
  admins: number
  listings: number
  /** Listings with status 'available'. */
  activeListings: number
  hiddenListings: number
  openDisputes: number
  resolvedDisputes: number
  rentalsInProgress: number
  salesInEscrow: number
  /** Σ wallet_ledger.held: deposits and payouts the platform still holds (simulated). */
  heldEscrow: number
  /** Σ wallet_ledger.platform: commission, escrow and protection fees (simulated). */
  platformRevenue: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const raw = unwrap(await db().rpc('admin_stats')) as Record<string, number | string>
  const n = (key: keyof AdminStats) => Number(raw[key] ?? 0)
  return {
    users: n('users'),
    admins: n('admins'),
    listings: n('listings'),
    activeListings: n('activeListings'),
    hiddenListings: n('hiddenListings'),
    openDisputes: n('openDisputes'),
    resolvedDisputes: n('resolvedDisputes'),
    rentalsInProgress: n('rentalsInProgress'),
    salesInEscrow: n('salesInEscrow'),
    heldEscrow: n('heldEscrow'),
    platformRevenue: n('platformRevenue'),
  }
}

export type ModerationAction = 'hide' | 'restore' | 'remove'

/**
 * hide: pause the listing and lock it (the seller can't relist) ·
 * restore: unlock it (stays paused until the seller relists) ·
 * remove: delete it (only without rental or sale history).
 */
export async function moderateListing(
  listingId: string,
  action: ModerationAction,
  reason?: string,
): Promise<'hidden' | 'restored' | 'removed'> {
  return unwrap(
    await db().rpc('admin_moderate_listing', { p_listing_id: listingId, p_action: action, p_reason: reason }),
  ) as 'hidden' | 'restored' | 'removed'
}

export interface ModeratedListing extends Listing {
  hiddenAt?: string
  hiddenReason?: string
}

/** Every listing, newest first, with its moderation flag. */
export async function listAllListingsForModeration(): Promise<ModeratedListing[]> {
  const rows = unwrap(
    await db()
      .from('listings')
      .select(`${LISTING_COLUMNS}, hidden_at, hidden_reason`)
      .order('created_at', { ascending: false }),
  )
  return rows.map((row) => ({
    ...mapListing(row),
    hiddenAt: row.hidden_at ?? undefined,
    hiddenReason: row.hidden_reason ?? undefined,
  }))
}

/** Every profile (signed-in users can read profiles), newest first. */
export async function listAllUsers(): Promise<User[]> {
  const rows = unwrap(await db().from('users').select('*').order('joined', { ascending: false }))
  return rows.map(mapUser)
}
