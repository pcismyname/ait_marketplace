// Profiles (public.users). One row per auth user, created automatically at
// signup. is_admin, rating and reviews_count are server-controlled; the
// email always mirrors the auth email.

import type { TablesUpdate } from '../database.types'
import type { User } from '../types'
import { db, requireUserId, unwrap, unwrapMaybe } from './client'
import { mapUser } from './mappers'

export async function getProfile(userId: string): Promise<User | null> {
  const row = unwrapMaybe(await db().from('users').select('*').eq('id', userId).maybeSingle())
  return row ? mapUser(row) : null
}

export async function listProfiles(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return []
  return unwrap(await db().from('users').select('*').in('id', userIds)).map(mapUser)
}

export async function getMyProfile(): Promise<User | null> {
  return getProfile(await requireUserId())
}

export interface ProfileUpdate {
  name?: string
  avatar?: string
  program?: string
  batch?: string
  pickupLocation?: string
  /** e.g. ['buy', 'sell', 'rent', 'rent-out'] */
  roleIntents?: string[]
  /** YYYY-MM-DD */
  arrivalDate?: string | null
  departureDate?: string | null
  /** Set when onboarding is finished. */
  onboarded?: boolean
}

export async function updateMyProfile(update: ProfileUpdate): Promise<User> {
  const uid = await requireUserId()
  const row: TablesUpdate<'users'> = {}
  if (update.name !== undefined) row.name = update.name
  if (update.avatar !== undefined) row.avatar = update.avatar
  if (update.program !== undefined) row.program = update.program
  if (update.batch !== undefined) row.batch = update.batch
  if (update.pickupLocation !== undefined) row.pickup_location = update.pickupLocation
  if (update.roleIntents !== undefined) row.role_intents = update.roleIntents
  if (update.arrivalDate !== undefined) row.arrival_date = update.arrivalDate
  if (update.departureDate !== undefined) row.departure_date = update.departureDate
  if (update.onboarded) row.onboarded_at = new Date().toISOString()
  return mapUser(unwrap(await db().from('users').update(row).eq('id', uid).select('*').single()))
}
