'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CircleCheck,
  Clock,
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
import { getWalletSummary } from '@/lib/api'
import { BRAND, PAYMENT_METHODS } from '@/lib/data'
import {
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
import { formatPrice, relativeTime } from '@/lib/format'
import type { Listing, PaymentMethod, Rental } from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { DemoPaymentsNote } from '@/components/rentals/demo-payments-note'
import { PHASE_META, rentalQuote } from '@/components/rentals/rental-helpers'
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
  return (
    <Suspense fallback={null}>
      <Checkout />
    </Suspense>
  )
}

function Checkout() {
  const { id } = useParams<{ id: string }>()
  const { listings, loading } = useMarketplace()
  const listing = listings.find((l) => l.id === id)

  if (!listing) {
    return (
      <p className="py-24 text-center text-[13px] text-muted-foreground">
        {loading ? 'Loading…' : 'This listing is no longer available.'}
      </p>
    )
  }
  return listing.type === 'rent' ? <RentCheckout listing={listing} /> : <SaleCheckout listing={listing} />
}

// ─── Rental: pay an approved booking (BusinessRules §4) ─────────────────────

function RentCheckout({ listing }: { listing: Listing }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { rentals, currentUserId, payRental, getUser, loading } = useMarketplace()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('promptpay')
  const [processing, setProcessing] = useState(false)
  const [walletAvailable, setWalletAvailable] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getWalletSummary().then(
      (s) => !cancelled && setWalletAvailable(s.available),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  const mine = rentals.filter((r) => r.listingId === listing.id && r.renterId === currentUserId)
  const requestedId = searchParams.get('rental')
  // An explicit ?rental= wins; otherwise only an open booking (approved, then
  // requested) counts. A finished booking of the same item means "request again".
  const rental: Rental | undefined =
    (requestedId ? mine.find((r) => r.id === requestedId) : undefined) ??
    mine.find((r) => r.phase === 'approved') ??
    mine.find((r) => r.phase === 'requested')
  const owner = getUser(listing.sellerId)

  if (listing.sellerId === currentUserId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center" data-testid="not-payable">
        <Info className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">This is your listing</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          Renters pay here after you approve their request. Review and approve requests from your listing&apos;s
          requests page.
        </p>
        <Link href={`/dashboard/listings/${listing.id}/requests`} className={cn(buttonVariants({ size: 'lg' }), 'mt-8 px-5')}>
          Booking requests
        </Link>
      </div>
    )
  }

  if (!rental && loading) {
    return <p className="py-24 text-center text-[13px] text-muted-foreground">Loading your booking…</p>
  }

  if (!rental || rental.phase !== 'approved') {
    return <NotPayable listing={listing} rental={rental} ownerName={owner.name} />
  }

  // pay_rental charges quote_rental(rental_fee, deposit) from the booking's
  // columns; computeRentalQuote is the same function (parity-tested).
  const quote = rentalQuote(rental)
  const walletShort = walletAvailable !== null && walletAvailable < quote.totalDueNow

  const onPay = async () => {
    setProcessing(true)
    try {
      const paid = await payRental(rental.id, paymentMethod)
      toast.success('Booking paid (simulated)', {
        description: `${formatPrice(paid.totalPaid ?? quote.totalDueNow)} paid. The ${formatPrice(paid.deposit)} deposit is held by ${BRAND} until the item comes back.`,
      })
      router.push('/rentals?view=renting')
    } catch (error) {
      toast.error('Payment failed', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <CheckoutShell
      title="Pay for your booking"
      intro={`${owner.name} approved your request ${relativeTime(rental.approvedAt ?? rental.requestedAt)}. One payment covers the rental, the platform fees and the refundable deposit.`}
      left={
        <>
          <MethodPicker
            value={paymentMethod}
            onChange={setPaymentMethod}
            walletAvailable={walletAvailable}
            walletShort={walletShort}
          />
          <div className="flex items-start gap-3 border border-border bg-surface p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">How the deposit is held</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-muted-foreground">
                <li>The deposit is held by {BRAND}. The owner never holds it.</li>
                <li>
                  The owner receives the rental fee {OWNER_PAYOUT_DELAY_HOURS} hours after handover. Your{' '}
                  {rental.periodDays}-day rental period starts at handover.
                </li>
                <li>
                  After you return the item there is a {DISPUTE_WINDOW_HOURS}-hour window to report a problem. With no
                  dispute the deposit (minus any late fee) is refunded to your wallet when it closes, or at once when
                  the owner confirms a good return.
                </li>
              </ul>
            </div>
          </div>
        </>
      }
      summary={
        <>
          <SummaryHeader listing={listing} />
          <dl className="space-y-3 border-t border-border pt-4 text-[13px]" data-testid="rent-quote">
            <SummaryRow label={`Rental fee (${rental.rentalPeriod ?? 'per semester'})`} value={quote.rentalFee} />
            <SummaryRow label={`Platform commission (${pct(RENTAL_COMMISSION_RATE)})`} value={quote.commission} />
            <SummaryRow
              label="Escrow handling fee"
              hint={`max(${formatPrice(ESCROW_FEE_MIN)}, ${pct(ESCROW_FEE_RATE)} of deposit)`}
              value={quote.handlingFee}
            />
            <SummaryRow label="Deposit" hint="Refundable, held by the platform" value={quote.deposit} />
          </dl>
          <div className="flex items-end justify-between border-t border-border pt-4">
            <p className="text-[14px] font-semibold">Total due now</p>
            <p className="font-display text-2xl font-bold text-foreground" data-testid="rent-total">
              {formatPrice(quote.totalDueNow)}
            </p>
          </div>
          <p className="-mt-4 text-[11px] text-muted-foreground">
            {formatPrice(quote.refundable)} of this comes back to you after the return.
          </p>
          <Button
            onClick={onPay}
            disabled={processing || (paymentMethod === 'wallet' && walletShort)}
            className="h-11 w-full text-[13px] font-semibold"
          >
            {processing ? 'Processing…' : `Pay ${formatPrice(quote.totalDueNow)}`}
          </Button>
          <DemoPaymentsNote />
        </>
      }
    />
  )
}

function NotPayable({ listing, rental, ownerName }: { listing: Listing; rental?: Rental; ownerName: string }) {
  let title: string
  let body: string
  let href = `/listing/${listing.id}`
  let cta = 'Back to the listing'
  let Icon: LucideIcon = Info

  if (!rental) {
    title = 'Request to book first'
    body = `Rentals are paid only after the owner approves. Send ${ownerName} a booking request from the listing page; you'll be able to pay here once it's approved.`
  } else if (rental.phase === 'requested') {
    Icon = Clock
    title = 'Waiting for the owner to approve'
    body = `${ownerName} hasn't answered your request yet. You'll get a notification when it's approved, and then you can pay here.`
    href = '/rentals?view=renting'
    cta = 'Go to My Rentals'
  } else if (rental.phase === 'declined' || rental.phase === 'cancelled') {
    title = rental.phase === 'declined' ? 'This request was declined' : 'This booking was cancelled'
    body = `Nothing was paid.${rental.declineReason ? ` Reason: “${rental.declineReason}”.` : ''} You can send a new request if the item is available.`
  } else {
    Icon = CircleCheck
    title = 'This booking is already paid'
    body = `Its status is “${PHASE_META[rental.phase].label}”. Track the handover, return and deposit in My Rentals.`
    href = '/rentals?view=renting'
    cta = 'Go to My Rentals'
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" data-testid="not-payable">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      <Link href={href} className={cn(buttonVariants({ size: 'lg' }), 'mt-8 px-5')}>
        {cta}
      </Link>
    </div>
  )
}

// ─── Sale: in person or with protection (BusinessRules §5) ──────────────────

function SaleCheckout({ listing }: { listing: Listing }) {
  const router = useRouter()
  const { createSale, startThread, getThreadForListing } = useMarketplace()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('promptpay')
  const [saleMode, setSaleMode] = useState<SalePaymentMode>('protected')
  const [processing, setProcessing] = useState(false)
  const [walletAvailable, setWalletAvailable] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getWalletSummary().then(
      (s) => !cancelled && setWalletAvailable(s.available),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  const saleQuote = computeSaleQuote(listing.price, saleMode)
  const inPerson = saleQuote.mode === 'in-person'
  const total = saleQuote.total
  const walletShort = walletAvailable !== null && walletAvailable < total
  const methodLabel = PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label

  const messageSeller = (text: string) => {
    if (!getThreadForListing(listing.id)) startThread(listing.id, listing.sellerId, text)
  }

  // Simulated: no gateway, no real money (BusinessRules.md §7). The server
  // computes the amounts and moves the purchase to its next state.
  const onPay = async () => {
    setProcessing(true)
    try {
      if (inPerson) {
        await createSale(listing.id, 'in-person')
        messageSeller(
          `Hi! I'd like to buy "${listing.title}" and pay you in person at handover (${formatPrice(listing.price)}). When can we meet at ${listing.pickupLocation}?`,
        )
        toast.success('In-person purchase confirmed', {
          description: `Pay the seller ${formatPrice(listing.price)} at handover. The seller marks the listing as sold.`,
        })
        router.push('/chat')
        return
      }

      const tx = await createSale(listing.id, 'protected', paymentMethod)
      messageSeller(
        `Hi! I just paid for "${listing.title}" with buyer protection. When can we meet at ${listing.pickupLocation}?`,
      )
      toast.success('Payment held by ' + BRAND + ' (simulated)', {
        description: `Paid ${formatPrice(total)} by ${methodLabel}. The seller is paid ${DISPUTE_WINDOW_HOURS} hours after handover unless you open a dispute.`,
      })
      router.push(`/transaction/${tx.id}`)
    } catch (error) {
      toast.error('Checkout failed', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <CheckoutShell
      title="Checkout"
      intro="Choose how you want to pay for this item."
      left={
        <>
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

          {inPerson ? (
            <div className="flex items-start gap-3 border border-border bg-surface p-5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
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
              <MethodPicker
                value={paymentMethod}
                onChange={setPaymentMethod}
                walletAvailable={walletAvailable}
                walletShort={walletShort}
              />
              <div className="flex items-start gap-3 border border-border bg-surface p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Buyer protection</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Your payment is held by {BRAND}, not the seller. After handover you have {DISPUTE_WINDOW_HOURS} hours
                    to open a dispute. If you don&apos;t, the money is released to the seller automatically when the
                    window closes. Confirming receipt sooner releases it at once.
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      }
      summary={
        <>
          <SummaryHeader listing={listing} />
          <dl className="space-y-3 border-t border-border pt-4 text-[13px]">
            <SummaryRow label="Item price" value={saleQuote.price} />
            {inPerson ? (
              <SummaryRow label="Protection" hint="Not included" value={0} />
            ) : (
              <SummaryRow
                label="Buyer protection fee"
                hint={`${formatPrice(BUYER_PROTECTION_BASE_FEE)} + ${pct(BUYER_PROTECTION_RATE)} of price`}
                value={saleQuote.protectionFee}
              />
            )}
          </dl>
          <div className="flex items-end justify-between border-t border-border pt-4">
            <p className="text-[14px] font-semibold">{inPerson ? 'Pay the seller at handover' : 'Total to pay'}</p>
            <p className="font-display text-2xl font-bold text-foreground">{formatPrice(total)}</p>
          </div>
          <Button
            onClick={onPay}
            disabled={processing || (!inPerson && paymentMethod === 'wallet' && walletShort)}
            className="h-11 w-full text-[13px] font-semibold"
          >
            {processing ? 'Processing…' : inPerson ? 'Confirm in-person purchase' : `Pay ${formatPrice(total)}`}
          </Button>
          {!inPerson && <DemoPaymentsNote />}
        </>
      }
    />
  )
}

// ─── Shared pieces ──────────────────────────────────────────────────────────

function CheckoutShell({
  title,
  intro,
  left,
  summary,
}: {
  title: string
  intro: string
  left: React.ReactNode
  summary: React.ReactNode
}) {
  const router = useRouter()
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="mb-12">
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-4 text-[14px] text-muted-foreground">{intro}</p>
          </div>
          {left}
        </div>
        <div>
          <div className="sticky top-24 space-y-6 border border-border bg-card p-6">
            <h2 className="text-lg font-semibold tracking-tight">Order Summary</h2>
            {summary}
            <p className="text-center text-[10px] text-muted-foreground">
              By confirming, you agree to the {BRAND} terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryHeader({ listing }: { listing: Listing }) {
  return (
    <div className="flex gap-4">
      <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-surface-tinted">
        <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" />
      </div>
      <div className="flex flex-col justify-center">
        <p className="line-clamp-2 text-[14px] font-semibold">{listing.title}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Tag className="h-3 w-3 text-muted-foreground" />
          <span className="text-[12px] font-medium capitalize text-muted-foreground">{listing.type}</span>
        </div>
      </div>
    </div>
  )
}

function MethodPicker({
  value,
  onChange,
  walletAvailable,
  walletShort,
}: {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  walletAvailable: number | null
  walletShort: boolean
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Payment method</h2>
      <div className="grid gap-3" role="radiogroup" aria-label="Payment method">
        {PAYMENT_METHODS.map((m) => {
          const Icon = METHOD_ICONS[m.id]
          const active = value === m.id
          const isWallet = m.id === 'wallet'
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
                <p className="mt-0.5 text-[11px] font-medium text-primary">
                  {isWallet && walletAvailable !== null
                    ? `Available: ${formatPrice(walletAvailable)}${walletShort ? ' · not enough for this payment' : ''}`
                    : METHOD_NOTES[m.id]}
                </p>
              </div>
              <input
                type="radio"
                name="payment"
                value={m.id}
                checked={active}
                onChange={() => onChange(m.id)}
                className="h-4 w-4 text-primary focus:ring-primary"
              />
            </label>
          )
        })}
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
