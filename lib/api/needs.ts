// Pre-arrival needs and server-side matching (match_needs, migration
// 20261025020500_needs_matching.sql, docs/Database.md §2 and §4).
//
// A need matches live listings with the same category and a fitting type
// while it is open (no needed-by date, or needed-by at most 30 days ago).
// The owner is notified (kind 'need_match') when a matching listing goes live.

import type { CategoryId } from '../types'
import { check, db, requireUserId, unwrap } from './client'

/** Which listings a need wants. */
export type NeedListingType = 'any' | 'sale' | 'rent'

/** Days after the needed-by date that a need keeps matching (same as private.need_is_open). */
export const NEED_MATCH_GRACE_DAYS = 30

export interface NeedRecord {
  id: string
  userId: string
  title: string
  category: CategoryId
  note: string
  /** Display text (legacy free text, or the formatted needed-by date). */
  arrivalDate: string
  /** YYYY-MM-DD, or undefined when the student didn't give one. */
  neededBy?: string
  listingType: NeedListingType
  createdAt: string
}

export interface NeedMatch {
  needId: string
  listingId: string
  featured: boolean
  listedAt: string
}

type NeedRow = {
  id: string
  user_id: string
  title: string
  category: string
  note: string | null
  arrival_date: string
  needed_by: string | null
  listing_type: string
  created_at: string | null
}

function mapNeed(row: NeedRow): NeedRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category as CategoryId,
    note: row.note ?? '',
    arrivalDate: row.arrival_date,
    neededBy: row.needed_by ?? undefined,
    listingType: (['sale', 'rent'].includes(row.listing_type) ? row.listing_type : 'any') as NeedListingType,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/**
 * True while the need still matches (mirrors private.need_is_open). The
 * database's current_date is the UTC date, so the cutoff is computed in UTC
 * too; otherwise a need near its cutoff could disagree for a few hours.
 */
export function isNeedOpen(need: Pick<NeedRecord, 'neededBy'>, today: Date = new Date()): boolean {
  if (!need.neededBy) return true
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - NEED_MATCH_GRACE_DAYS))
  return need.neededBy.slice(0, 10) >= cutoff.toISOString().slice(0, 10)
}

/** Every need (needs are visible to all signed-in users), newest first. */
export async function listNeeds(): Promise<NeedRecord[]> {
  const rows = unwrap(await db().from('needs').select('*').order('created_at', { ascending: false }))
  return rows.map(mapNeed)
}

export interface NewNeed {
  title: string
  category: CategoryId
  note?: string
  /** YYYY-MM-DD */
  neededBy: string
  listingType: NeedListingType
}

const displayDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export async function createNeed(input: NewNeed): Promise<NeedRecord> {
  const uid = await requireUserId()
  const row = unwrap(
    await db()
      .from('needs')
      .insert({
        user_id: uid,
        title: input.title,
        category: input.category,
        note: input.note ?? '',
        arrival_date: displayDate(input.neededBy),
        needed_by: input.neededBy,
        listing_type: input.listingType,
      })
      .select('*')
      .single(),
  )
  return mapNeed(row)
}

/** Change a need's needed-by date (e.g. to reopen a closed need). */
export async function updateNeedDate(needId: string, neededBy: string): Promise<NeedRecord> {
  const row = unwrap(
    await db()
      .from('needs')
      .update({ needed_by: neededBy, arrival_date: displayDate(neededBy) })
      .eq('id', needId)
      .select('*')
      .single(),
  )
  return mapNeed(row)
}

export async function deleteNeed(needId: string): Promise<void> {
  check(await db().from('needs').delete().eq('id', needId))
}

/** Live listings matching the caller's own needs (or one need by id), featured first. */
export async function matchNeeds(needId?: string): Promise<NeedMatch[]> {
  const rows = unwrap(await db().rpc('match_needs', needId ? { p_need_id: needId } : {}))
  return rows.map((r) => ({
    needId: r.need_id,
    listingId: r.listing_id,
    featured: Boolean(r.featured),
    listedAt: r.listed_at,
  }))
}
