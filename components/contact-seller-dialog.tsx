'use client'

// "Message the seller" from a listing. start_thread reuses the pair's thread
// on this listing (one thread per listing per pair of users) or creates it,
// then the chat opens on that thread.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import type { Listing } from '@/lib/types'
import { DISPUTE_WINDOW_HOURS } from '@/lib/fees'

export function ContactSellerDialog({
  listing,
  trigger,
  intent = 'message',
}: {
  listing: Listing
  trigger: React.ReactNode
  intent?: 'message' | 'rent'
}) {
  const { startThread, getUser, getThreadForListing, currentUserId } = useMarketplace()
  const router = useRouter()
  const seller = getUser(listing.sellerId)
  const [open, setOpen] = useState(false)
  const existing = getThreadForListing(listing.id)

  const suggestion =
    intent === 'rent'
      ? `Hi ${seller.name}, I'd like to rent "${listing.title}". Is it available this semester?`
      : `Hi ${seller.name}, is "${listing.title}" still available?`

  const [text, setText] = useState(suggestion)

  const onSend = () => {
    if (!text.trim()) return
    if (!currentUserId) {
      toast.error('Log in to send a message')
      router.push(`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`)
      return
    }
    try {
      const thread = startThread(listing.id, listing.sellerId, text.trim())
      setOpen(false)
      toast.success('Message sent', { description: `Your message to ${seller.name} is in your chat.` })
      // thread.id is the client's optimistic id. If start_thread reuses a
      // thread we hadn't loaded, the server's id differs and the store
      // reloads; listing + with let /chat find the real thread then.
      const params = new URLSearchParams({ thread: thread.id, listing: listing.id, with: listing.sellerId })
      router.push(`/chat?${params.toString()}`)
    } catch (error) {
      toast.error('Could not send the message', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {intent === 'rent' ? 'Request to rent' : 'Message'} {seller.name}
          </DialogTitle>
          <DialogDescription>
            {intent === 'rent'
              ? `Agree on dates and pickup. PassItOn holds the deposit, never the owner, and refunds it after the return once the owner confirms, or ${DISPUTE_WINDOW_HOURS} hours after the return if there is no claim.`
              : 'Ask a question, negotiate the price, or arrange a campus pickup.'}
          </DialogDescription>
        </DialogHeader>
        {existing && (
          <p className="text-[12px] text-muted-foreground">
            You already have a conversation about this item. Your message is added to it.{' '}
            <Link href={`/chat?thread=${encodeURIComponent(existing.id)}`} className="font-semibold text-primary hover:underline">
              Open chat
            </Link>
          </p>
        )}
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
          <Button onClick={onSend} disabled={!text.trim()}>Send message</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
