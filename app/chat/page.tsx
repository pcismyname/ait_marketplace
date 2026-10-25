'use client'

// Messages. Threads, messages and live updates come from the store
// (Supabase Realtime on `messages`, filtered by RLS; a message in a thread we
// don't have yet reloads the thread list). One thread per listing per pair of
// users (start_thread). Unread counts compare each message with
// thread_participants.last_read_at, which mark_thread_read sets when the
// thread is open. The selected thread lives in the URL (?thread=<id>), the
// same link the "new message" notifications use (docs/Database.md §1).

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, MapPin, MessageCircle } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import type { Thread } from '@/lib/types'
import { markThreadRead } from '@/lib/api'
import { getMyReadMarkers, unreadCount, type ReadMarkers } from '@/lib/api/chat-read'
import { formatPrice, relativeTime, initials } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const lastMessageAt = (t: Thread) => t.messages[t.messages.length - 1]?.createdAt ?? ''
const later = (a: string | null | undefined, b: string | null | undefined) =>
  !a ? (b ?? null) : !b ? a : new Date(a) >= new Date(b) ? a : b

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function ChatInner() {
  const { threads, listings, currentUserId, sendMessage, getUser, loading } = useMarketplace()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('thread')

  const [draft, setDraft] = useState('')
  const [markers, setMarkers] = useState<ReadMarkers>({})
  // Until the server's markers arrive, every message would look unread, so
  // badges, the unread total and auto mark-read wait for the first answer.
  const [markersLoaded, setMarkersLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const marking = useRef<string | null>(null)
  // Only an open thread in a visible tab counts as read.
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== 'hidden', () => true)

  const selected = threads.find((t) => t.id === selectedId) ?? null
  // Opened from the contact dialog with an optimistic thread id: if the server
  // reused another thread (the store then reloads), switch to that one.
  const listingParam = searchParams.get('listing')
  const withParam = searchParams.get('with')
  const fallbackId =
    !selected && selectedId && listingParam && withParam && currentUserId
      ? (threads.find(
          (t) =>
            t.listingId === listingParam &&
            t.participantIds.includes(currentUserId) &&
            t.participantIds.includes(withParam),
        )?.id ?? null)
      : null
  useEffect(() => {
    if (fallbackId) router.replace(`/chat?thread=${encodeURIComponent(fallbackId)}`, { scroll: false })
  }, [fallbackId, router])
  const listingFor = (t: Thread) => listings.find((l) => l.id === t.listingId)
  const otherIdFor = (t: Thread) => t.participantIds.find((p) => p !== currentUserId) ?? t.participantIds[0]

  // Read markers from the database; reloaded when a new thread shows up.
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    getMyReadMarkers().then(
      (server) => {
        if (cancelled) return
        setMarkers((local) => {
          const merged: ReadMarkers = { ...server }
          for (const [id, at] of Object.entries(local)) merged[id] = later(at, server[id])
          return merged
        })
        setMarkersLoaded(true)
      },
      (error: Error) => {
        console.warn('Could not load read markers:', error.message)
        if (!cancelled) setMarkersLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [currentUserId, threads.length])

  const unreadFor = (t: Thread) => (markersLoaded ? unreadCount(t, currentUserId, markers[t.id]) : 0)
  const selectedUnread = selected ? unreadFor(selected) : 0
  const selectedLatest = selected ? lastMessageAt(selected) : ''

  // The open thread is read: tell the server (also clears its notification).
  useEffect(() => {
    if (!selected || !visible || selectedUnread === 0 || marking.current === selected.id) return
    const threadId = selected.id
    const readUpTo = selectedLatest
    marking.current = threadId
    markThreadRead(threadId)
      .then(() => setMarkers((prev) => ({ ...prev, [threadId]: later(prev[threadId], readUpTo) })))
      .catch((error: Error) => console.warn('Could not mark the thread read:', error.message))
      .finally(() => {
        marking.current = null
      })
  }, [selected, visible, selectedUnread, selectedLatest])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selected?.messages.length, selectedId])

  const select = (id: string | null) => {
    router.replace(id ? `/chat?thread=${encodeURIComponent(id)}` : '/chat', { scroll: false })
  }

  const onSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || !selected) return
    sendMessage(selected.id, draft.trim())
    setDraft('')
  }

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => +new Date(lastMessageAt(b) || 0) - +new Date(lastMessageAt(a) || 0)),
    [threads],
  )
  const totalUnread = threads.reduce((sum, t) => sum + unreadFor(t), 0)

  if (loading) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <p className="text-[12px] text-muted-foreground">Loading your conversations…</p>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="mt-5 text-[14px] font-medium">No messages yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Start a conversation from any listing to negotiate and arrange pickup.
        </p>
        <Link
          href="/"
          className="mt-5 rounded-sm bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Browse items
        </Link>
      </div>
    )
  }

  const other = selected ? getUser(otherIdFor(selected)) : null
  const selectedListing = selected ? listingFor(selected) : undefined

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      {/* Page title */}
      <div className="mb-12">
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
        <p className="mt-1 text-[12px] text-muted-foreground" data-testid="chat-unread-total">
          {!markersLoaded
            ? ' '
            : totalUnread > 0
              ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`
              : 'All caught up'}
        </p>
      </div>

      {/* Two-panel chat */}
      <div className="grid h-[calc(100vh-16rem)] min-h-125 grid-cols-[minmax(0,1fr)] overflow-hidden border border-border md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Thread list */}
        <aside className={cn('min-w-0 flex-col border-r border-border', selected ? 'hidden md:flex' : 'flex')}>
          <div className="flex-1 overflow-y-auto divide-y divide-border" data-testid="thread-list">
            {sortedThreads.map((t) => {
              const listing = listingFor(t)
              const person = getUser(otherIdFor(t))
              const last = t.messages[t.messages.length - 1]
              const active = t.id === selectedId
              const unread = unreadFor(t)
              return (
                <button
                  key={t.id}
                  onClick={() => select(t.id)}
                  data-thread-id={t.id}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                    active ? 'bg-surface-tinted' : 'hover:bg-surface',
                  )}
                >
                  {/* Listing thumbnail */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden bg-surface-tinted">
                    {listing && (
                      <Image
                        src={listing.images[0] || '/placeholder.svg'}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate text-[13px]', unread > 0 ? 'font-bold' : 'font-semibold')}>
                        {person.name}
                      </p>
                      {last && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{listing?.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      {last && (
                        <p className={cn(
                          'truncate text-[11px]',
                          unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground/70',
                        )}>
                          {last.senderId === currentUserId ? 'You: ' : ''}{last.text}
                        </p>
                      )}
                      {unread > 0 && (
                        <span
                          className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                          aria-label={`${unread} unread`}
                          data-testid="unread-badge"
                        >
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Conversation panel */}
        <section className={cn('flex min-h-0 min-w-0 flex-col', selected ? 'flex' : 'hidden md:flex')}>
          {selected && other ? (
            <>
              {/* Convo header */}
              <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
                <button onClick={() => select(null)} className="md:hidden" aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Link href={`/profile/${other.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-surface-tinted text-[10px] font-bold text-muted-foreground">
                      {initials(other.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{other.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{other.program}</p>
                  </div>
                </Link>
              </header>

              {/* Listing context bar */}
              {selectedListing && (
                <Link
                  href={`/listing/${selectedListing.id}`}
                  className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-tinted shrink-0"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden bg-surface-tinted">
                    <Image
                      src={selectedListing.images[0] || '/placeholder.svg'}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{selectedListing.title}</p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {selectedListing.pickupLocation}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold">
                    {formatPrice(selectedListing.price)}
                    {selectedListing.type === 'rent' && (
                      <span className="text-[11px] font-normal text-muted-foreground"> {selectedListing.rentalPeriod}</span>
                    )}
                  </span>
                </Link>
              )}

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="message-list">
                {selected.messages.map((m) => {
                  const mine = m.senderId === currentUserId
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'min-w-0 max-w-[78%] px-3.5 py-2 text-[13px]',
                        mine
                          ? 'bg-primary text-primary-foreground rounded-sm rounded-br-none'
                          : 'bg-surface text-foreground rounded-sm rounded-bl-none border border-border',
                      )}>
                        <p className="text-pretty whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
                        <p className={cn('mt-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {relativeTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Send input */}
              <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border p-3 shrink-0">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  maxLength={2000}
                  className="h-10 flex-1 rounded-sm border border-input bg-background px-4 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center text-[12px] text-muted-foreground md:flex">
              Select a conversation to start chatting.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  )
}
