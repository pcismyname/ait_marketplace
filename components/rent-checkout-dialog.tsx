'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CreditCard,
  Lock,
  QrCode,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
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
import { useMarketplace } from '@/lib/store'
import { PAYMENT_METHODS, getUser } from '@/lib/data'
import { computeRentalQuote, RENTAL_COMMISSION_RATE } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Listing, PaymentMethod } from '@/lib/types'
import { cn } from '@/lib/utils'

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  promptpay: QrCode,
  card: CreditCard,
  wallet: Wallet,
}

/**
 * The "e-teller" step: an in-platform checkout that collects the rental fee,
 * the platform's commission and handling fee, and the refundable deposit in
 * one payment, then places the deposit in escrow. Payment is simulated.
 */
export function RentCheckoutDialog({
  listing,
  trigger,
}: {
  listing: Listing
  trigger: React.ReactNode
}) {
  const { startRental } = useMarketplace()
  const router = useRouter()
  const owner = getUser(listing.sellerId)
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('promptpay')

  const quote = computeRentalQuote({ price: listing.price, deposit: listing.deposit })

  const onConfirm = () => {
    const rental = startRental(listing.id, method)
    setOpen(false)
    if (!rental) {
      toast.error('This item can no longer be rented')
      return
    }
    toast.success('Booking confirmed', {
      description: `${formatPrice(quote.deposit)} deposit is now held in escrow. ${owner.name} has been notified.`,
    })
    router.push('/rentals')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rent from {owner.name}</DialogTitle>
          <DialogDescription>
            One payment covers the rental, the platform fee and the refundable deposit.
            The deposit comes back to you once {owner.name} confirms the return.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-4 text-sm">
          <Row label={`Rental fee (${listing.rentalPeriod ?? 'per semester'})`} value={quote.rentalFee} />
          <Row
            label={`Platform commission (${Math.round(RENTAL_COMMISSION_RATE * 100)}%)`}
            value={quote.commission}
          />
          <Row label="Escrow handling fee" value={quote.handlingFee} />
          <Row label="Refundable deposit" value={quote.deposit} muted />
          <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
            <dt>Total due now</dt>
            <dd className="font-display text-base">{formatPrice(quote.totalDueNow)}</dd>
          </div>
        </dl>

        <div className="flex items-start gap-2 rounded-2xl bg-surge-muted p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
          <p className="text-xs text-surge-foreground">
            <span className="font-semibold">{formatPrice(quote.refundable)} is refundable.</span>{' '}
            It stays in escrow, not with the owner, until the item comes back in good
            condition. If there is damage, either side can open a dispute.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pay with
          </p>
          <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.id]
              const active = method === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <Icon
                    className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Payment is simulated in this prototype. Nothing is charged.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Pay {formatPrice(quote.totalDueNow)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', muted && 'text-muted-foreground')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatPrice(value)}</dd>
    </div>
  )
}
