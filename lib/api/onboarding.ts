// Onboarding state for the signed-in user (public.users: role_intents,
// onboarded_at and the profile fields). Saving goes through updateMyProfile
// (lib/api/profiles.ts).

import type { User } from '../types'
import { db, requireUserId, unwrapMaybe } from './client'
import { mapUser, type UserRow } from './mappers'

/** What the student wants to do on PassItOn (users.role_intents). */
export const ROLE_INTENTS = [
  { id: 'buy', label: 'Buy', hint: 'Pick up things other students sell' },
  { id: 'sell', label: 'Sell', hint: 'Pass on what you no longer need' },
  { id: 'rent', label: 'Rent', hint: 'Borrow items for a semester' },
  { id: 'rent-out', label: 'Rent out', hint: 'Earn from things you own' },
] as const

export type RoleIntent = (typeof ROLE_INTENTS)[number]['id']

export interface MyOnboarding {
  profile: User
  roleIntents: RoleIntent[]
  /** Set once onboarding was completed. */
  onboardedAt?: string
}

export async function getMyOnboarding(): Promise<MyOnboarding | null> {
  const uid = await requireUserId()
  const row: UserRow | null = unwrapMaybe<UserRow>(await db().from('users').select('*').eq('id', uid).maybeSingle())
  if (!row) return null
  const known = new Set<string>(ROLE_INTENTS.map((r) => r.id))
  return {
    profile: mapUser(row),
    roleIntents: (row.role_intents ?? []).filter((r): r is RoleIntent => known.has(r)),
    onboardedAt: row.onboarded_at ?? undefined,
  }
}
