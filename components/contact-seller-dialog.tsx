'use client'

import { useState } from 'react'
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
import { getUser } from '@/lib/data'

export function ContactSellerDialog({
  listing,
  trigger,
  intent = 'message',
}: {
  listing: Listing
  trigger: React.ReactNode
  intent?: 'message' | 'rent'
}) {
  const { startThread } = useMarketplace()
  const router = useRouter()
  const seller = getUser(listing.sellerId)
  const [open, setOpen] = useState(false)

  const suggestion =
    intent === 'rent'
      ? `Hi ${seller.name}, I'd like to rent "${listing.title}". Is it available this semester?`
      : `Hi ${seller.name}, is "${listing.title}" still available?`

  const [text, setText] = useState(suggestion)

  const onSend = () => {
    if (!text.trim()) return
    startThread(listing.id, listing.sellerId, text.trim())
    setOpen(false)
    toast.success('Message sent', {
      description: `Your message to ${seller.name} is in your chat.`,
    })
    router.push('/chat')
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
              ? 'Agree on dates and pickup. The deposit is held in escrow and returned after the item comes back in good condition.'
              : 'Ask a question, negotiate the price, or arrange a campus pickup.'}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="resize-none"
          aria-label="Message"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSend}>Send message</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
