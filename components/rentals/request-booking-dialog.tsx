'use client'

import { useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useMarketplace } from '@/lib/store'
import { BRAND } from '@/lib/data'
import { computeRentalQuote } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Listing } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * "Request to book" (BusinessRules §4: request → owner approves → renter pays).
 * Nothing is paid here; request_rental stores the server's quote and notifies
 * the owner.
 */
export function RequestBookingDialog({ listing, trigger }: { listing: Listing; trigger: ReactElement }) {
  const { requestRental, getUser } = useMarketplace()
  const router = useRouter()
  const owner = getUser(listing.sellerId)
  const quote = computeRentalQuote({ price: listing.price, deposit: listing.deposit })
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      await requestRental(listing.id, message.trim() || undefined)
      setOpen(false)
      setMessage('')
      toast.success('Booking request sent', {
        description: `${owner.name.split(' ')[0]} approves it first; then you pay ${formatPrice(quote.totalDueNow)} to confirm.`,
      })
      router.push('/rentals')
    } catch (error) {
      toast.error('Could not send the request', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request to book</DialogTitle>
          <DialogDescription>
            {owner.name} approves the request first. Nothing is paid until then, and you can cancel any time before
            paying.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-1.5 rounded-md bg-surface p-3 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Rental fee ({listing.rentalPeriod ?? 'per semester'})</dt>
            <dd className="tabular-nums">{formatPrice(quote.rentalFee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Platform fees (commission + escrow)</dt>
            <dd className="tabular-nums">{formatPrice(quote.platformFees)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Refundable deposit, held by {BRAND}</dt>
            <dd className="tabular-nums">{formatPrice(quote.deposit)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold">
            <dt>Due after approval</dt>
            <dd className="tabular-nums">{formatPrice(quote.totalDueNow)}</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          <label htmlFor="booking-message" className="label-tag">
            Message to {owner.name.split(' ')[0]} (optional)
          </label>
          <Textarea
            id="booking-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={`e.g. I'd like it from next week and can pick it up at ${listing.pickupLocation}.`}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
