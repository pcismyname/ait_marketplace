'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import type { Rental } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { rentalQuote } from './rental-helpers'

/** Owner's approve / decline buttons for a `requested` booking (respond_rental). */
export function RespondRequestActions({
  rental,
  blockedReason,
  className,
}: {
  rental: Rental
  /** Why approving isn't possible right now (another booking in progress, listing paused…). */
  blockedReason?: string | null
  className?: string
}) {
  const { respondRental, getUser } = useMarketplace()
  const renter = getUser(rental.renterId)
  const [busy, setBusy] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')

  const respond = async (approve: boolean) => {
    setBusy(true)
    try {
      await respondRental(rental.id, approve, approve ? undefined : reason.trim() || undefined)
      if (approve) {
        toast.success('Request approved', {
          description: `${renter.name} can now pay ${formatPrice(rentalQuote(rental).totalDueNow)}. The listing is reserved for them.`,
        })
      } else {
        toast('Request declined', { description: `${renter.name} has been notified.` })
        setDeclineOpen(false)
        setReason('')
      }
    } catch (error) {
      toast.error(approve ? 'Could not approve the request' : 'Could not decline the request', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => respond(true)} disabled={busy || Boolean(blockedReason)}>
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDeclineOpen(true)} disabled={busy}>
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
      </div>
      {blockedReason && <p className="mt-1.5 max-w-xs text-[11px] text-muted-foreground">{blockedReason}</p>}

      <Dialog open={declineOpen} onOpenChange={(open) => !busy && setDeclineOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline {renter.name}&apos;s request?</DialogTitle>
            <DialogDescription>
              Nothing has been paid yet. You can add a short reason; {renter.name.split(' ')[0]} will see it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="e.g. I need it back before the end of the semester"
            aria-label="Reason (optional)"
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={busy}>
              Keep request
            </Button>
            <Button variant="destructive" onClick={() => respond(false)} disabled={busy}>
              {busy ? 'Declining…' : 'Decline request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Why the owner can't approve this request right now, or null. Mirrors respond_rental's checks. */
export function approveBlockedReason(
  rental: Rental,
  rentals: Rental[],
  listingStatus: string | undefined,
): string | null {
  const inProgress = rentals.some(
    (r) =>
      r.listingId === rental.listingId &&
      r.id !== rental.id &&
      ['approved', 'paid', 'active', 'return-pending', 'disputed', 'overdue'].includes(r.phase),
  )
  if (inProgress) return 'Another booking for this item is in progress. Approve once it ends, or decline.'
  if (listingStatus && listingStatus !== 'available') {
    return `The listing is ${listingStatus}. Make it available again before approving.`
  }
  return null
}
