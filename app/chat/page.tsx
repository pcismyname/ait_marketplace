'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Send, MapPin, MessageCircle } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { getUser } from '@/lib/data'
import type { Thread } from '@/lib/types'
import { formatPrice, relativeTime, initials } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const CANNED_REPLIES = [
  'Sounds good! That works for me.',
  'Yes it is still available. When would you like to pick it up?',
  'I could do a small discount if you can collect it today.',
  'Great, let me know when you are at the lobby and I will bring it down.',
]

function ChatInner() {
  const { threads, listings, currentUserId, sendMessage, receiveMessage } =
    useMarketplace()

  const [selectedId, setSelectedId] = useState<string | null>(
    threads[0]?.id ?? null,
  )
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const selected = threads.find((t) => t.id === selectedId) ?? null

  const listingFor = (t: Thread) => listings.find((l) => l.id === t.listingId)
  const otherIdFor = (t: Thread) =>
    t.participantIds.find((p) => p !== currentUserId) ?? t.participantIds[0]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selected?.messages.length, selectedId])

  const onSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || !selected) return
    const threadId = selected.id
    const otherId = otherIdFor(selected)
    sendMessage(threadId, draft.trim())
    setDraft('')
    const reply = CANNED_REPLIES[selected.messages.length % CANNED_REPLIES.length]
    setTimeout(() => receiveMessage(threadId, otherId, reply), 1100)
  }

  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const am = a.messages[a.messages.length - 1]?.createdAt ?? ''
        const bm = b.messages[b.messages.length - 1]?.createdAt ?? ''
        return +new Date(bm) - +new Date(am)
      }),
    [threads],
  )

  if (threads.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-bold">No messages yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a conversation from any listing to negotiate and arrange pickup.
        </p>
        <Link
          href="/browse"
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Browse items
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-border bg-card md:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <aside
          className={cn(
            'flex-col border-r border-border',
            selected ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <h1 className="font-display text-lg font-bold">Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedThreads.map((t) => {
              const listing = listingFor(t)
              const other = getUser(otherIdFor(t))
              const last = t.messages[t.messages.length - 1]
              const active = t.id === selectedId
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition',
                    active ? 'bg-secondary/70' : 'hover:bg-secondary/40',
                  )}
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
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
                      <p className="truncate text-sm font-semibold">{other.name}</p>
                      {last && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {relativeTime(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {listing?.title}
                    </p>
                    {last && (
                      <p className="truncate text-xs text-muted-foreground/80">
                        {last.senderId === currentUserId ? 'You: ' : ''}
                        {last.text}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Conversation */}
        <section className={cn('flex-col', selected ? 'flex' : 'hidden md:flex')}>
          {selected ? (
            <Conversation
              key={selected.id}
              thread={selected}
              listing={listingFor(selected)}
              otherId={otherIdFor(selected)}
              currentUserId={currentUserId}
              draft={draft}
              setDraft={setDraft}
              onSend={onSend}
              onBack={() => setSelectedId(null)}
              scrollRef={scrollRef}
            />
          ) : (
            <div className="hidden flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
              Select a conversation to start chatting.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Conversation({
  thread,
  listing,
  otherId,
  currentUserId,
  draft,
  setDraft,
  onSend,
  onBack,
  scrollRef,
}: {
  thread: Thread
  listing: ReturnType<typeof useMarketplace>['listings'][number] | undefined
  otherId: string
  currentUserId: string
  draft: string
  setDraft: (v: string) => void
  onSend: (e: React.FormEvent) => void
  onBack: () => void
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const other = getUser(otherId)

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="md:hidden" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {initials(other.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{other.name}</p>
          <p className="truncate text-xs text-muted-foreground">{other.program}</p>
        </div>
      </header>

      {listing && (
        <Link
          href={`/listing/${listing.id}`}
          className="flex items-center gap-3 border-b border-border bg-secondary/30 px-4 py-2.5 transition hover:bg-secondary/50"
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image
              src={listing.images[0] || '/placeholder.svg'}
              alt=""
              fill
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{listing.title}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {listing.pickupLocation}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold">
            {formatPrice(listing.price)}
            {listing.type === 'rent' && (
              <span className="text-[11px] font-normal text-muted-foreground">
                {' '}
                {listing.rentalPeriod}
              </span>
            )}
          </span>
        </Link>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {thread.messages.map((m) => {
          const mine = m.senderId === currentUserId
          return (
            <div
              key={m.id}
              className={cn('flex', mine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm',
                  mine
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-secondary text-secondary-foreground',
                )}
              >
                <p className="text-pretty">{m.text}</p>
                <p
                  className={cn(
                    'mt-1 text-[10px]',
                    mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {relativeTime(m.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-ring"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  )
}
