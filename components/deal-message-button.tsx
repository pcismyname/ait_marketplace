'use client'

// "Message" on the deal page. Opens the thread between the viewer and the
// other party of this deal on this listing (one thread per listing per pair,
// docs/Database.md). With no thread yet, a small dialog sends the first
// message through start_thread, then the chat opens on it.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMarketplace } from '@/lib/store'

const LINK_CLASS = 'inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline'

export function DealMessageButton({
  listingId,
  listingTitle,
  otherId,
  otherName,
}: {
  listingId: string
  listingTitle: string
  otherId: string
  otherName: string
}) {
  const { threads, currentUserId, startThread } = useMarketplace()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(`Hi ${otherName}, about our deal for "${listingTitle}": `)

  const thread = currentUserId
    ? threads.find(
        (t) =>
          t.listingId === listingId && t.participantIds.includes(currentUserId) && t.participantIds.includes(otherId),
      )
    : undefined

  if (thread) {
    return (
      <Link href={`/chat?thread=${encodeURIComponent(thread.id)}`} className={LINK_CLASS} data-testid="deal-message">
        <MessageCircle className="h-3.5 w-3.5" /> Message
      </Link>
    )
  }

  const onSend = () => {
    if (!text.trim()) return
    try {
      const started = startThread(listingId, otherId, text.trim())
      setOpen(false)
      toast.success('Message sent', { description: `Your message to ${otherName} is in your chat.` })
      // started.id is optimistic; listing + with let /chat find the real one.
      const params = new URLSearchParams({ thread: started.id, listing: listingId, with: otherId })
      router.push(`/chat?${params.toString()}`)
    } catch (error) {
      toast.error('Could not send the message', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className={LINK_CLASS} data-testid="deal-message">
            <MessageCircle className="h-3.5 w-3.5" /> Message
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {otherName}</DialogTitle>
          <DialogDescription>Arrange the pickup or return, or ask about the item.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          className="resize-none"
          aria-label="Message"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={!text.trim()}>
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
