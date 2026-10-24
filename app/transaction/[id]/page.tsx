'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMarketplace } from '@/lib/store'
import { BRAND, getUser } from '@/lib/data'
import { computeSaleQuote, DISPUTE_WINDOW_HOURS } from '@/lib/fees'
import { formatPrice } from '@/lib/format'

/**
 * A protected sale held in escrow (BusinessRules.md §5, §6). Simulated: the
 * transaction is derived from the listing in the id (`tx_<listingId>`), with
 * mock fallbacks when the listing can't be found.
 */
export default function TransactionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings } = useMarketplace()
  const listing = listings.find((l) => `tx_${l.id}` === id)
  const quote = computeSaleQuote(listing?.price ?? 200, 'protected')
  const tx = {
    id: id,
    itemTitle: listing?.title ?? 'Bicycle U-Lock',
    quote,
    status: 'in_escrow', // paid, in_escrow, completed, disputed
    seller: { name: listing ? getUser(listing.sellerId).name : 'Emma W.' },
    pickup: listing?.pickupLocation ?? 'SU Building (Ground Floor)',
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="text-center mb-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary-muted text-primary mb-4 border border-primary/20">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="label-tag mb-2">Payment Secured</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Transaction {tx.id}</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">
          Your payment is held by {BRAND}, not the seller. Payments are simulated in this demo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Col: Escrow & Actions */}
        <div className="space-y-6">
          <div className="border border-border bg-surface p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-[15px] font-semibold">Escrow Status</h2>
            </div>
            
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-surface z-10">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold">Payment Held</p>
                  <p className="text-[11px] text-muted-foreground">{BRAND} is holding {formatPrice(tx.quote.total)}</p>
                </div>
              </div>
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-surface z-10 animate-pulse">
                  <Clock className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold">Awaiting Pickup</p>
                  <p className="text-[11px] text-muted-foreground">Meet the seller to inspect item</p>
                </div>
              </div>
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-surface z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>
                <div className="flex-1 min-w-0 opacity-50">
                  <p className="text-[13px] font-semibold">{DISPUTE_WINDOW_HOURS}-hour dispute window</p>
                  <p className="text-[11px] text-muted-foreground">Opens at handover</p>
                </div>
              </div>
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-surface z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>
                <div className="flex-1 min-w-0 opacity-50">
                  <p className="text-[13px] font-semibold">Funds Released</p>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically when the window closes with no dispute, or at once when you confirm receipt
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <h3 className="text-[14px] font-semibold mb-2">Have you received the item?</h3>
            <p className="text-[12px] text-muted-foreground mb-4">
              If you don&apos;t confirm, the funds go to the seller automatically {DISPUTE_WINDOW_HOURS} hours after
              handover. Confirming receipt after inspecting the item releases them right away.
            </p>
            <Button onClick={() => router.push(`/transaction/${tx.id}/confirm`)} className="w-full h-10 text-[12px]">
              Confirm Receipt
            </Button>
          </div>
        </div>

        {/* Right Col: Details */}
        <div className="space-y-6">
          <div className="border border-border bg-card p-6 space-y-6">
            <h2 className="text-[15px] font-semibold">Order Details</h2>
            
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Item</p>
              <p className="text-[13px] font-medium">{tx.itemTitle}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</p>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Item price</dt>
                  <dd className="font-medium tabular-nums">{formatPrice(tx.quote.price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Buyer protection fee</dt>
                  <dd className="font-medium tabular-nums">{formatPrice(tx.quote.protectionFee)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <dt className="font-semibold">Total paid</dt>
                  <dd className="font-display font-semibold tabular-nums">{formatPrice(tx.quote.total)}</dd>
                </div>
              </dl>
            </div>
            
            <div className="pt-4 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pickup Location</p>
              <div className="flex items-start gap-2 text-[13px]">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{tx.pickup}</p>
                  <p className="text-muted-foreground mt-0.5">Please coordinate the exact time with the seller via chat.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Seller</p>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium">{tx.seller.name}</p>
                <Link href="/chat" className="text-[12px] font-semibold text-primary hover:underline">
                  Message
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold">Issue with the item?</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                If the item doesn&apos;t match the description or the seller doesn&apos;t show up, file a dispute within{' '}
                {DISPUTE_WINDOW_HOURS} hours of handover to stop the release. An admin reviews the chat and photos.
              </p>
              <Link href={`/dispute/${tx.id}`} className="text-[11px] font-semibold text-destructive hover:underline flex items-center gap-1">
                File a dispute <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}
