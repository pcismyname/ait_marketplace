// In-app notifications. Written by the server (RPCs, triggers, the escrow
// job); clients can only read their own, mark them read and delete them.
//
// kinds: rental_requested, rental_approved, rental_declined, rental_cancelled,
// rental_paid, rental_handover, rental_returned, rental_released,
// rental_resolved, rental_missing, rental_overdue, rental_payout,
// sale_requested, sale_paid, sale_handover, sale_released, sale_resolved,
// sale_completed, sale_cancelled, window_reminder, dispute_opened,
// dispute_comment, message, review

import type { AppNotification } from '../types'
import { check, db, subscribeToTable, toApiError, unwrap } from './client'
import { mapNotification, type NotificationRow } from './mappers'

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const rows = unwrap(
    await db().from('notifications').select('*').order('created_at', { ascending: false }).limit(limit),
  )
  return rows.map(mapNotification)
}

export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw toApiError(error)
  return count ?? 0
}

/** Mark some (or, with no ids, all) of the user's notifications read. Returns how many changed. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  return unwrap(await db().rpc('mark_notifications_read', { p_ids: ids }))
}

export async function deleteNotification(id: string): Promise<void> {
  check(await db().from('notifications').delete().eq('id', id))
}

/** New and updated notifications for the signed-in user. */
export function subscribeToNotifications(
  userId: string,
  onNotification: (n: AppNotification) => void,
): () => void {
  return subscribeToTable<NotificationRow>(
    'notifications',
    (row, event) => {
      if (event !== 'DELETE') onNotification(mapNotification(row))
    },
    `user_id=eq.${userId}`,
  )
}
