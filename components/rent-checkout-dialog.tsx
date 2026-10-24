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
import { BRAND, PAYMENT_METHODS, getUser } from '@/lib/data'
import {
  computeRentalQuote,
  DISPUTE_WINDOW_HOURS,
  ESCROW_FEE_MIN,
  ESCROW_FEE_RATE,
  OWNER_PAYOUT_DELAY_HOURS,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Listing, PaymentMethod } from '@/lib/types'
import { cn } from '@/lib/utils'

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  promptpay: QrCode,
  card: CreditCard,
  wallet: Wallet,
}

/** Extra context per method (BusinessRules.md §8). */
const METHOD_NOTES: Record<PaymentMethod, string> = {
  promptpay: 'Default · lowest fees',
  card: 'For students without a Thai bank account yet',
  wallet: 'Uses your refunded deposits',
}

/**
 * The "e-teller" step: an in-platform checkout that collects the rental fee,
 * the platform's commission and escrow handling fee, and the refundable deposit
 * in one payment, then places the deposit in escrow (held by the platform, never
 * the owner). Payment is simulated: no gateway (BusinessRules.md §7).
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
      description: `${formatPrice(quote.deposit)} deposit is held by ${BRAND}. ${owner.name} has been notified.`,
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
            One payment covers the rental, the platform fees and the refundable deposit.
            {owner.name} receives the rental fee {OWNER_PAYOUT_DELAY_HOURS} hours after handover.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-xl border border-border bg-surface p-4 text-[13px]">
          <Row label={`Rental fee (${listing.rentalPeriod ?? 'per semester'})`} value={quote.rentalFee} />
          <Row
            label={`Platform commission (${Math.round(RENTAL_COMMISSION_RATE * 100)}%)`}
            value={quote.commission}
          />
          <Row
            label={`Escrow handling fee · max(${formatPrice(ESCROW_FEE_MIN)}, ${Math.round(ESCROW_FEE_RATE * 100)}% of deposit)`}
            value={quote.handlingFee}
          />
          <Row label="Refundable deposit" value={quote.deposit} muted />
          <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
            <dt>Total due now</dt>
            <dd className="font-display text-base">{formatPrice(quote.totalDueNow)}</dd>
          </div>
        </dl>

        <div className="flex items-start gap-2 rounded-xl border border-surge/20 bg-surge-surface p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-surge-foreground" />
          <p className="text-xs text-surge-foreground">
            <span className="font-semibold">{formatPrice(quote.refundable)} is refundable.</span>{' '}
            {BRAND} holds it, never the owner. After you return the item, the owner has{' '}
            {DISPUTE_WINDOW_HOURS} hours to report damage. With no claim it is refunded
            automatically when that window closes, or at once if the owner confirms good condition.
          </p>
        </div>

        <div className="space-y-2">
          <p className="label-tag mb-2">
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
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150',
                    active
                      ? 'border-primary bg-primary-muted ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/30',
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
                    <span className="block text-[11px] font-medium text-primary">
                      {METHOD_NOTES[m.id]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Demo mode — payments are simulated, no real money moves.
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
