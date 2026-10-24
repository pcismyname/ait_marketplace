// Chat read markers (thread_participants.last_read_at) for unread counts.
// Written only by mark_thread_read (lib/api/chat.ts markThreadRead).

import type { Thread } from '../types'
import { db, requireUserId, unwrap } from './client'

/** threadId → when the signed-in user last read it (null: never). */
export type ReadMarkers = Record<string, string | null>

export async function getMyReadMarkers(): Promise<ReadMarkers> {
  const uid = await requireUserId()
  const rows = unwrap(await db().from('thread_participants').select('thread_id, last_read_at').eq('user_id', uid))
  return Object.fromEntries(rows.map((r) => [r.thread_id, r.last_read_at]))
}

/** Messages from other people newer than the read marker. */
export function unreadCount(thread: Thread, userId: string | null, lastReadAt: string | null | undefined): number {
  if (!userId) return 0
  const since = lastReadAt ? new Date(lastReadAt).getTime() : -Infinity
  return thread.messages.filter((m) => m.senderId !== userId && new Date(m.createdAt).getTime() > since).length
}
