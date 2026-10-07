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
  const { threads, listings, currentUserId, sendMessage, receiveMessage } = useMarketplace()

  const [selectedId, setSelectedId] = useState<string | null>(threads[0]?.id ?? null)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const selected = threads.find((t) => t.id === selectedId) ?? null
  const listingFor = (t: Thread) => listings.find((l) => l.id === t.listingId)
  const otherIdFor = (t: Thread) => t.participantIds.find((p) => p !== currentUserId) ?? t.participantIds[0]

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
    () => [...threads].sort((a, b) => {
      const am = a.messages[a.messages.length - 1]?.createdAt ?? ''
      const bm = b.messages[b.messages.length - 1]?.createdAt ?? ''
      return +new Date(bm) - +new Date(am)
    }),
    [threads],
  )

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Page title */}
      <div className="mb-4 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">Messages</h1>
      </div>

      {/* Two-panel chat */}
      <div className="grid h-[calc(100vh-10rem)] overflow-hidden border border-border md:grid-cols-[280px_1fr]">
        {/* Thread list */}
        <aside className={cn('flex-col border-r border-border', selected ? 'hidden md:flex' : 'flex')}>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
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
                      <p className="truncate text-[13px] font-semibold">{other.name}</p>
                      {last && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(last.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{listing?.title}</p>
                    {last && (
                      <p className="truncate text-[11px] text-muted-foreground/70">
                        {last.senderId === currentUserId ? 'You: ' : ''}{last.text}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Conversation panel */}
        <section className={cn('flex flex-col', selected ? 'flex' : 'hidden md:flex')}>
          {selected ? (
            <>
              {/* Convo header */}
              <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
                <button onClick={() => setSelectedId(null)} className="md:hidden" aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-surface-tinted text-[10px] font-bold text-muted-foreground">
                    {initials(getUser(otherIdFor(selected)).name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{getUser(otherIdFor(selected)).name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{getUser(otherIdFor(selected)).program}</p>
                </div>
              </header>

              {/* Listing context bar */}
              {listingFor(selected) && (
                <Link
                  href={`/listing/${listingFor(selected)!.id}`}
                  className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-tinted shrink-0"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden bg-surface-tinted">
                    <Image
                      src={listingFor(selected)!.images[0] || '/placeholder.svg'}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{listingFor(selected)!.title}</p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {listingFor(selected)!.pickupLocation}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold">
                    {formatPrice(listingFor(selected)!.price)}
                    {listingFor(selected)!.type === 'rent' && (
                      <span className="text-[11px] font-normal text-muted-foreground"> {listingFor(selected)!.rentalPeriod}</span>
                    )}
                  </span>
                </Link>
              )}

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {selected.messages.map((m) => {
                  const mine = m.senderId === currentUserId
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[78%] px-3.5 py-2 text-[13px]',
                        mine
                          ? 'bg-primary text-primary-foreground rounded-sm rounded-br-none'
                          : 'bg-surface text-foreground rounded-sm rounded-bl-none border border-border',
                      )}>
                        <p className="text-pretty">{m.text}</p>
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
