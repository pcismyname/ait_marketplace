'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Send, ShieldCheck } from 'lucide-react'
import { addDisputeComment, listDisputeComments, subscribeToDisputeComments } from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import { initials } from '@/lib/format'
import { BRAND } from '@/lib/data'
import type { DisputeComment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDateTime } from './dispute-helpers'

/**
 * Discussion on a dispute: both parties and admins post while it is open
 * (dispute_comments, RLS). New comments arrive over Realtime.
 */
export function CommentThread({ disputeId, open }: { disputeId: string; open: boolean }) {
  const { currentUserId, getUser } = useMarketplace()
  const [comments, setComments] = useState<DisputeComment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const add = (comment: DisputeComment) =>
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]))
    listDisputeComments(disputeId).then(
      (list) => {
        if (cancelled) return
        setComments((prev) => {
          const merged = [...list]
          for (const c of prev) if (!merged.some((m) => m.id === c.id)) merged.push(c)
          return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        })
        setLoaded(true)
      },
      (e: Error) => {
        if (!cancelled) toast.error('Could not load the comments', { description: e.message })
      },
    )
    const unsubscribe = subscribeToDisputeComments(disputeId, add)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [disputeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [comments.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    try {
      const comment = await addDisputeComment(disputeId, text)
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]))
      setBody('')
    } catch (error) {
      toast.error('Could not post the comment', { description: (error as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Dispute discussion">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold">Discussion</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Both parties and the {BRAND} admin can see and post here.
        </p>
      </div>
      <div className="max-h-[420px] space-y-4 overflow-y-auto px-5 py-4" data-testid="comment-list">
        {loaded && comments.length === 0 && (
          <p className="text-[12px] text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((c) => {
          const author = getUser(c.authorId)
          const mine = c.authorId === currentUserId
          return (
            <div key={c.id} className={cn('flex gap-3', mine && 'flex-row-reverse text-right')}>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  author.isAdmin ? 'bg-foreground text-background' : 'bg-primary-muted text-primary',
                )}
              >
                {initials(author.name)}
              </div>
              <div className="min-w-0 max-w-[80%]">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{mine ? 'You' : author.name}</span>
                  {author.isAdmin && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-semibold uppercase tracking-wider text-primary">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </span>
                  )}
                  <span className="ml-1.5">{formatDateTime(c.createdAt)}</span>
                </p>
                <p
                  className={cn(
                    'mt-1 inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-[13px]',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-background border border-border',
                  )}
                >
                  {c.body}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      {open ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-border px-5 py-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add details, answer a question, share what you agreed…"
            maxLength={4000}
            className="min-h-[44px] resize-none text-[13px]"
            aria-label="Comment"
          />
          <Button type="submit" disabled={sending || !body.trim()} className="h-10 px-4">
            <Send className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Post</span>
          </Button>
        </form>
      ) : (
        <p className="border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
          This dispute is resolved, so the discussion is closed.
        </p>
      )}
    </section>
  )
}
