// Shared plumbing for the typed client API in lib/api/*.
//
// Every function in lib/api runs in the browser with the signed-in user's
// session (publishable key + RLS). Money and state changes go through the
// SECURITY DEFINER RPCs described in docs/Database.md; nothing here writes
// rentals, transactions, disputes or the wallet ledger directly.

import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

/** The browser Supabase client (a singleton per tab). */
export const db = () => createClient()

/**
 * Error thrown by every lib/api function. `message` is written for people
 * (the RPCs raise friendly messages), so it can go straight into a toast.
 */
export class ApiError extends Error {
  readonly code?: string
  readonly details?: string
  constructor(message: string, code?: string, details?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export function toApiError(error: PostgrestError | { message: string; code?: string }): ApiError {
  const code = 'code' in error ? error.code : undefined
  if (code === '42501') {
    return new ApiError("You don't have permission to do that.", code)
  }
  if (code === '28000') {
    return new ApiError('Log in to continue.', code)
  }
  return new ApiError(error.message, code, 'details' in error ? (error.details ?? undefined) : undefined)
}

/** Return `data` or throw an ApiError. */
export function unwrap<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw toApiError(result.error)
  if (result.data === null || result.data === undefined) {
    throw new ApiError('Nothing was returned.')
  }
  return result.data as NonNullable<T>
}

/** Throw an ApiError if the call failed (for calls that return nothing). */
export function check(result: { error: PostgrestError | null }): void {
  if (result.error) throw toApiError(result.error)
}

/** Like unwrap, but `null` data is a valid answer (e.g. maybeSingle()). */
export function unwrapMaybe<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw toApiError(result.error)
  return result.data ?? null
}

/** The signed-in user's id, or an ApiError when logged out. */
export async function requireUserId(): Promise<string> {
  const { data } = await db().auth.getUser()
  if (!data.user) throw new ApiError('Log in to continue.', '28000')
  return data.user.id
}

/**
 * Subscribe to inserts / updates on a table (Supabase Realtime, filtered by
 * RLS for the signed-in user). Returns an unsubscribe function.
 */
export function subscribeToTable<Row>(
  table: 'messages' | 'notifications' | 'rentals' | 'transactions' | 'disputes' | 'dispute_comments',
  onRow: (row: Row, event: 'INSERT' | 'UPDATE' | 'DELETE') => void,
  filter?: string,
): () => void {
  const client = db()
  const channel = client
    .channel(`${table}:${filter ?? 'all'}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Row
        onRow(row, payload.eventType)
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
