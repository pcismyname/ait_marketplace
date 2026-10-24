// Chat: one thread per listing per pair of users. Threads and participants
// are created only by start_thread (atomically, with the first message);
// later messages are plain inserts, allowed for thread participants.

import type { Message } from '../types'
import { check, db, requireUserId, subscribeToTable, unwrap } from './client'

/**
 * Message `otherUserId` about a listing. Reuses the existing thread for the
 * pair, or creates it. Pass client ids for optimistic UI.
 */
export async function startThread(
  listingId: string,
  otherUserId: string,
  text: string,
  ids: { threadId?: string; messageId?: string } = {},
): Promise<{ threadId: string; messageId: string; created: boolean }> {
  const result = unwrap(
    await db().rpc('start_thread', {
      p_listing_id: listingId,
      p_other_user_id: otherUserId,
      p_text: text,
      p_thread_id: ids.threadId,
      p_message_id: ids.messageId,
    }),
  ) as { thread_id: string; message_id: string; created: boolean }
  return { threadId: result.thread_id, messageId: result.message_id, created: result.created }
}

export async function sendMessage(threadId: string, text: string, messageId?: string): Promise<Message> {
  const senderId = await requireUserId()
  const row = unwrap(
    await db()
      .from('messages')
      .insert({ id: messageId ?? crypto.randomUUID(), thread_id: threadId, sender_id: senderId, text })
      .select('*')
      .single(),
  )
  return { id: row.id, senderId: row.sender_id, text: row.text, createdAt: row.created_at ?? new Date().toISOString() }
}

/** Record that the user has read the thread (also clears its message notification). */
export async function markThreadRead(threadId: string): Promise<void> {
  check(await db().rpc('mark_thread_read', { p_thread_id: threadId }))
}

/** New messages in any of the user's threads (RLS-filtered). */
export function subscribeToMessages(onMessage: (threadId: string, message: Message) => void): () => void {
  return subscribeToTable<{ id: string; thread_id: string; sender_id: string; text: string; created_at: string }>(
    'messages',
    (row, event) => {
      if (event !== 'INSERT') return
      onMessage(row.thread_id, { id: row.id, senderId: row.sender_id, text: row.text, createdAt: row.created_at })
    },
  )
}
