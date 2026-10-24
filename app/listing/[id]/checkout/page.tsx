'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CreditCard,
  Handshake,
  Info,
  QrCode,
  ShieldCheck,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND, PAYMENT_METHODS } from '@/lib/data'
import {
  computeRentalQuote,
  computeSaleQuote,
  BUYER_PROTECTION_BASE_FEE,
  BUYER_PROTECTION_RATE,
  DISPUTE_WINDOW_HOURS,
  ESCROW_FEE_MIN,
  ESCROW_FEE_RATE,
  OWNER_PAYOUT_DELAY_HOURS,
  RENTAL_COMMISSION_RATE,
  type SalePaymentMode,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
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

const pct = (rate: number) => `${Math.round(rate * 100)}%`

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { listings, startRental, startThread, getThreadForListing, updateListingStatus } =
    useMarketplace()
  const listing = listings.find(l => l.id === id)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('promptpay')
  const [saleMode, setSaleMode] = useState<SalePaymentMode>('protected')
  const [processing, setProcessing] = useState(false)

  if (!listing) return null

  const isRent = listing.type === 'rent'
  const rentQuote = isRent ? computeRentalQuote({ price: listing.price, deposit: listing.deposit }) : null
  const saleQuote = isRent ? null : computeSaleQuote(listing.price, saleMode)
  const inPerson = saleQuote?.mode === 'in-person'
  const total = rentQuote ? rentQuote.totalDueNow : saleQuote!.total
  const methodLabel = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label

  const messageSeller = (text: string) => {
    if (!getThreadForListing(listing.id)) startThread(listing.id, listing.sellerId, text)
  }

  const onPay = () => {
    setProcessing(true)
    // Simulated: no gateway, no real money (BusinessRules.md §7).
    setTimeout(() => {
      setProcessing(false)

      if (isRent) {
        const rental = startRental(listing.id, paymentMethod)
        if (!rental) {
          toast.error('This item can no longer be rented')
          return
        }
        toast.success('Booking paid (simulated)', {
          description: `${formatPrice(rentQuote!.deposit)} deposit is held by ${BRAND} until the item comes back.`,
        })
        router.push('/rentals')
        return
      }

      if (inPerson) {
        messageSeller(
          `Hi! I'd like to buy "${listing.title}" and pay you in person at handover (${formatPrice(listing.price)}). When can we meet at ${listing.pickupLocation}?`,
        )
        toast.success('In-person purchase confirmed', {
          description: `Pay the seller ${formatPrice(listing.price)} at handover. The seller marks the listing as sold.`,
        })
        router.push('/chat')
        return
      }

      updateListingStatus(listing.id, 'reserved')
      messageSeller(
        `Hi! I just paid for "${listing.title}" with buyer protection. When can we meet at ${listing.pickupLocation}?`,
      )
      toast.success('Payment held by ' + BRAND + ' (simulated)', {
        description: `Paid ${formatPrice(total)} by ${methodLabel}. The seller is paid ${DISPUTE_WINDOW_HOURS} hours after handover unless you open a dispute.`,
      })
      router.push(`/transaction/tx_${listing.id}`)
    }, 1200)
  }

  const ctaLabel = processing
    ? 'Processing...'
    : inPerson
      ? 'Confirm in-person purchase'
      : `Pay ${formatPrice(total)}`

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">

        {/* Left Col: how to pay */}
        <div className="space-y-8">
          <div className="mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Checkout</h1>
            <p className="mt-4 text-[14px] text-muted-foreground">
              {isRent
                ? 'One payment covers the rental, the platform fees and the refundable deposit.'
                : 'Choose how you want to pay for this item.'}
            </p>
          </div>

          {/* Sale: in person vs. with protection (BusinessRules.md §2, §5) */}
          {!isRent && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">How do you want to pay?</h2>
              <div className="grid gap-3" role="radiogroup" aria-label="Sale payment option">
                <ModeOption
                  active={saleMode === 'protected'}
                  onSelect={() => setSaleMode('protected')}
                  icon={ShieldCheck}
                  title="Pay with protection"
                  price={`+ ${formatPrice(computeSaleQuote(listing.price, 'protected').protectionFee)}`}
                  description={`${formatPrice(BUYER_PROTECTION_BASE_FEE)} + ${pct(BUYER_PROTECTION_RATE)} of the price. ${BRAND} holds your money until handover plus ${DISPUTE_WINDOW_HOURS} hours. If the item isn't as described, you can open a dispute in that window.`}
                />
                <ModeOption
                  active={saleMode === 'in-person'}
                  onSelect={() => setSaleMode('in-person')}
                  icon={Handshake}
                  title="Pay in person"
                  price="Free"
                  description="Pay the seller directly when you meet. No escrow and no dispute support: once you hand over the money, it's between you and the seller."
                />
              </div>
            </div>
          )}

          {inPerson ? (
            <div className="border border-border bg-surface p-5 flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-foreground">Nothing is paid online</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Bring {formatPrice(listing.price)} to {listing.pickupLocation} and check the item before you pay.
                  After the handover, the seller marks the listing as sold.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">Payment method</h2>
                <div className="grid gap-3" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_METHODS.map(m => {
                    const Icon = METHOD_ICONS[m.id]
                    const active = paymentMethod === m.id
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 border p-4 transition-all',
                          active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                            active ? 'bg-primary text-primary-foreground' : 'bg-surface-tinted text-muted-foreground',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground">{m.label}</p>
                          <p className="text-[11px] text-muted-foreground">{m.hint}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-primary">{METHOD_NOTES[m.id]}</p>
                        </div>
                        <input
                          type="radio"
                          name="payment"
                          checked={active}
                          onChange={() => setPaymentMethod(m.id)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="border border-border bg-surface p-5 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    {isRent ? 'How the deposit is held' : 'Buyer protection'}
                  </p>
                  {isRent ? (
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
                      <li>The deposit is held by {BRAND}. The owner never holds it.</li>
                      <li>The owner receives the rental fee {OWNER_PAYOUT_DELAY_HOURS} hours after handover, unless a dispute is filed.</li>
                      <li>
                        After you return the item there is a {DISPUTE_WINDOW_HOURS}-hour window for the owner to report
                        damage. If no claim is made, the deposit is refunded automatically when it closes; if the owner
                        confirms good condition sooner, it is refunded at once.
                      </li>
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      Your payment is held by {BRAND}, not the seller. After handover you have {DISPUTE_WINDOW_HOURS} hours
                      to open a dispute. If you don&apos;t, the money is released to the seller automatically when the window
                      closes. Confirming receipt sooner releases it at once.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Col: Order Summary */}
        <div>
          <div className="sticky top-24 border border-border bg-card p-6 space-y-6">
            <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>

            <div className="flex gap-4">
              <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-surface-tinted">
                <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[14px] font-semibold line-clamp-2">{listing.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground capitalize">{listing.type}</span>
                </div>
              </div>
            </div>

            <dl className="space-y-3 border-t border-border pt-4 text-[13px]">
              {rentQuote ? (
                <>
                  <SummaryRow label={`Rental fee (${listing.rentalPeriod ?? 'per semester'})`} value={rentQuote.rentalFee} />
                  <SummaryRow label={`Platform commission (${pct(RENTAL_COMMISSION_RATE)})`} value={rentQuote.commission} />
                  <SummaryRow
                    label="Escrow handling fee"
                    hint={`max(${formatPrice(ESCROW_FEE_MIN)}, ${pct(ESCROW_FEE_RATE)} of deposit)`}
                    value={rentQuote.handlingFee}
                  />
                  <SummaryRow label="Deposit" hint="Refundable, held by the platform" value={rentQuote.deposit} />
                </>
              ) : (
                <>
                  <SummaryRow label="Item price" value={saleQuote!.price} />
                  {inPerson ? (
                    <SummaryRow label="Protection" hint="Not included" value={0} />
                  ) : (
                    <SummaryRow
                      label="Buyer protection fee"
                      hint={`${formatPrice(BUYER_PROTECTION_BASE_FEE)} + ${pct(BUYER_PROTECTION_RATE)} of price`}
                      value={saleQuote!.protectionFee}
                    />
                  )}
                </>
              )}
            </dl>

            <div className="flex items-end justify-between border-t border-border pt-4">
              <p className="text-[14px] font-semibold">
                {rentQuote ? 'Total due now' : inPerson ? 'Pay the seller at handover' : 'Total to pay'}
              </p>
              <p className="font-display text-2xl font-bold text-foreground">{formatPrice(total)}</p>
            </div>
            {rentQuote && (
              <p className="-mt-4 text-[11px] text-muted-foreground">
                {formatPrice(rentQuote.refundable)} of this comes back to you after the return.
              </p>
            )}

            <Button onClick={onPay} disabled={processing} className="w-full h-11 text-[13px] font-semibold">
              {ctaLabel}
            </Button>

            <div className="space-y-2 text-center text-[10px] text-muted-foreground px-2">
              {!inPerson && (
                <p className="border border-dashed border-border bg-surface px-3 py-2 text-[11px] font-medium text-foreground">
                  Demo mode — payments are simulated, no real money moves.
                </p>
              )}
              <p>By confirming, you agree to the {BRAND} terms of service.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function ModeOption({
  active,
  onSelect,
  icon: Icon,
  title,
  price,
  description,
}: {
  active: boolean
  onSelect: () => void
  icon: LucideIcon
  title: string
  price: string
  description: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 border p-4 transition-all',
        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-primary text-primary-foreground' : 'bg-surface-tinted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[12px] font-semibold tabular-nums text-foreground">{price}</p>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <input
        type="radio"
        name="sale-mode"
        checked={active}
        onChange={onSelect}
        className="mt-1 h-4 w-4 text-primary focus:ring-primary"
      />
    </label>
  )
}

function SummaryRow({ label, hint, value }: { label: string; hint?: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">
        {label}
        {hint && <span className="block text-[11px] opacity-80">{hint}</span>}
      </dt>
      <dd className="font-medium tabular-nums">{formatPrice(value)}</dd>
    </div>
  )
}
