'use client'

// Deal status page for both parties: a rental or a sale, resolved with
// getDeal(id) (notifications link here for both; docs/Database.md §1.5).
//
// - Timeline of the state machine (BusinessRules §4 rentals, §5 sales;
//   figures/renter_userflow.png, owner_userflow.png, buyer_userflow.png,
//   seller_userflow.png).
// - Amounts come only from the stored columns (fees are snapshotted by the
//   server at request / checkout), never recomputed here; the overdue late
//   fee so far uses lib/fees.ts.
// - Live countdowns to dispute_window_ends_at, payout_at and the due date.
//   When one passes while the page is open, the escrow jobs run and the deal
//   reloads (components/escrow-job-runner.tsx).
// - The actions the viewer has in this state; each is an RPC wrapper that
//   re-validates the transition server-side.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDot,
  Handshake,
  MapPin,
  ShieldCheck,
  ShieldOff,
  Star,
  XCircle,
} from 'lucide-react'
import {
  cancelSale,
  confirmSaleHandover,
  getDeal,
  getDisputeFor,
  getListing,
  getMyReviewForDeal,
  subscribeToRentals,
  subscribeToTransactions,
  type Deal,
} from '@/lib/api'
import type { Dispute, Listing, Review } from '@/lib/types'
import { useMarketplace } from '@/lib/store'
import { BRAND } from '@/lib/data'
import {
  dailyLateFee,
  daysLate,
  settleDeposit,
  DISPUTE_WINDOW_HOURS,
  OWNER_PAYOUT_DELAY_HOURS,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import {
  canFileDispute,
  dealId,
  dealListingId,
  dealRole,
  dealStatus,
  dealTimeline,
  disputeHref,
  fileDisputeHref,
  formatDateTime,
  isDealClosed,
  otherPartyId,
  OTHER_ROLE_LABEL,
  TONE_CLASS,
  type DealRole,
  type TimelineStep,
} from '@/lib/deal-status'
import { Button, buttonVariants } from '@/components/ui/button'
import { DealCountdown, useNow } from '@/components/deal-countdown'
import { EvidenceGallery, PhotoPicker, uploadPhotos, type PickedPhoto } from '@/components/evidence-photos'
import { ReviewDialog, type ReviewTarget } from '@/components/review-dialog'
import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'
import { ESCROW_RAN_EVENT, requestEscrowRun } from '@/components/escrow-job-runner'
import { DealMessageButton } from '@/components/deal-message-button'
import { cn } from '@/lib/utils'

type Loaded = {
  deal: Deal
  listing: Listing | null
  dispute: Dispute | null
  myReview: Review | null
}

type PageState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & Loaded)

async function loadDeal(id: string): Promise<PageState> {
  try {
    const deal = await getDeal(id)
    if (!deal) return { status: 'missing' }
    const target = deal.kind === 'rental' ? { rentalId: id } : { transactionId: id }
    const [listing, dispute, myReview] = await Promise.all([
      getListing(dealListingId(deal)).catch(() => null),
      getDisputeFor(target).catch(() => null),
      isDealClosed(deal) ? getMyReviewForDeal(target).catch(() => null) : Promise.resolve(null),
    ])
    return { status: 'ready', deal, listing, dispute, myReview }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  const reload = useCallback(async () => {
    const next = await loadDeal(id)
    setState(next)
  }, [id])

  useEffect(() => {
    let cancelled = false
    loadDeal(id).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Live: the other party acts, or the escrow job moves the deal on.
  useEffect(() => {
    const onChange = (changed: { id: string }) => {
      if (changed.id === id) void reload()
    }
    const unsubscribers = [subscribeToRentals(onChange), subscribeToTransactions(onChange)]
    const onJobs = () => void reload()
    window.addEventListener(ESCROW_RAN_EVENT, onJobs)
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener(ESCROW_RAN_EVENT, onJobs)
    }
  }, [id, reload])

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <p className="text-[13px] text-muted-foreground">Loading the deal…</p>
      </div>
    )
  }
  if (state.status !== 'ready') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <p className="label-tag mb-2">Deal</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {state.status === 'missing' ? 'Deal not found' : 'Could not load this deal'}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {state.status === 'missing'
            ? 'It may not exist, or you are not a party to it.'
            : state.message}
        </p>
        <Link href="/dashboard/orders" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
          Back to orders
        </Link>
      </div>
    )
  }
  return <DealView {...state} reload={reload} />
}

function DealView({ deal, listing, dispute, myReview, reload }: Loaded & { reload: () => Promise<void> }) {
  const { currentUserId, getUser } = useMarketplace()
  const searchParams = useSearchParams()
  const now = useNow(30_000)
  const role = dealRole(deal, currentUserId)
  const id = dealId(deal)
  const otherId = otherPartyId(deal, role)
  const other = otherId ? getUser(otherId) : null
  const status = dealStatus(deal)
  const timeline = dealTimeline(deal)
  const isRental = deal.kind === 'rental'
  const inPerson = deal.kind === 'sale' && deal.transaction.mode === 'in-person'

  const [reviewOpen, setReviewOpen] = useState(false)
  const [autoReviewDismissed, setAutoReviewDismissed] = useState(false)
  const [savedReview, setSavedReview] = useState<Review | null>(null)
  const review = savedReview ?? myReview
  const canReview = isDealClosed(deal) && role !== 'viewer' && Boolean(otherId) && !review
  const reviewTarget: ReviewTarget = isRental ? { rentalId: id } : { transactionId: id }
  const showReview = reviewOpen || (canReview && searchParams.get('review') === '1' && !autoReviewDismissed)

  // The runner dispatches ESCROW_RAN_EVENT when done, and the page reloads
  // on that event, so no reload here.
  const onDeadline = useCallback(() => {
    void requestEscrowRun()
  }, [])

  const kindLabel = isRental ? 'Rental' : inPerson ? 'Purchase · paid in person' : 'Purchase · with protection'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <Link
        href="/dashboard/orders"
        className="mb-8 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Orders
      </Link>

      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end">
        {listing && (
          <Link
            href={`/listing/${listing.id}`}
            className="relative h-24 w-24 shrink-0 overflow-hidden bg-surface-tinted"
          >
            <Image src={listing.images[0] || '/placeholder.svg'} alt={listing.title} fill className="object-cover" sizes="96px" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="label-tag mb-2">{kindLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{listing?.title ?? 'Item'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider', TONE_CLASS[status.tone])}
              data-testid="deal-status"
            >
              {status.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Ref {id.slice(0, 8)} · you are the {role === 'viewer' ? 'admin / viewer' : role}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8 min-w-0">
          <Countdowns deal={deal} now={now} onDeadline={onDeadline} />

          <ActionsPanel
            deal={deal}
            role={role}
            dispute={dispute}
            otherName={other?.name ?? OTHER_ROLE_LABEL[role]}
            now={now}
            reload={reload}
            onRate={canReview ? () => setReviewOpen(true) : undefined}
            review={review}
          />

          <section className="border border-border bg-card p-6">
            <h2 className="mb-5 text-[15px] font-semibold">Timeline</h2>
            <Timeline steps={timeline} />
          </section>

          {(isRental || !inPerson) && <PhotosSection deal={deal} />}
        </div>

        <aside className="space-y-6">
          <AmountsCard deal={deal} role={role} now={now} />

          <section className="border border-border bg-card p-6 space-y-5">
            <div>
              <p className="label-tag mb-2">Pickup point</p>
              <p className="flex items-start gap-2 text-[13px] font-medium">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {listing?.pickupLocation || 'Agree on a campus pickup point in chat'}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">No shipping: hand the item over on campus.</p>
            </div>
            {other && (
              <div className="border-t border-border pt-5">
                <p className="label-tag mb-2">{OTHER_ROLE_LABEL[role]}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/profile/${other.id}`} className="block truncate text-[13px] font-medium hover:underline">
                      {other.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {other.reviewsCount > 0
                        ? `★ ${other.rating.toFixed(1)} · ${other.reviewsCount} review${other.reviewsCount === 1 ? '' : 's'}`
                        : 'No reviews yet'}
                    </p>
                  </div>
                  {role !== 'viewer' && (
                    <DealMessageButton
                      listingId={dealListingId(deal)}
                      listingTitle={listing?.title ?? 'the item'}
                      otherId={other.id}
                      otherName={other.name}
                    />
                  )}
                </div>
              </div>
            )}
          </section>

          {inPerson ? (
            <div className="flex items-start gap-3 border border-border bg-surface p-4">
              <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Paid directly, no protection.</strong> The buyer pays the seller at
                pickup. {BRAND} holds no money for this sale, so it can&apos;t be disputed here.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 border border-border bg-surface p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {isRental
                  ? `${BRAND} holds the deposit, never the owner. The owner's rental fee is paid ${OWNER_PAYOUT_DELAY_HOURS} hours after handover; the deposit is settled after the return, with a ${DISPUTE_WINDOW_HOURS}-hour window for claims.`
                  : `${BRAND} holds the payment until ${DISPUTE_WINDOW_HOURS} hours after handover, then releases it to the seller unless the buyer files a dispute.`}
              </p>
            </div>
          )}
          <SimulatedPaymentsNote />
        </aside>
      </div>

      {otherId && other && (
        <ReviewDialog
          target={reviewTarget}
          subjectName={other.name}
          subjectRole={
            role === 'renter' ? 'owner' : role === 'owner' ? 'renter' : role === 'buyer' ? 'seller' : 'buyer'
          }
          open={showReview}
          onOpenChange={(open) => {
            setReviewOpen(open)
            if (!open) setAutoReviewDismissed(true)
          }}
          onSubmitted={setSavedReview}
        />
      )}
    </div>
  )
}

// ─── Countdowns ──────────────────────────────────────────────────────────────

function Countdowns({ deal, now, onDeadline }: { deal: Deal; now: number; onDeadline: () => void }) {
  const cards: React.ReactNode[] = []
  if (deal.kind === 'rental') {
    const r = deal.rental
    if (r.phase === 'return-pending' && r.disputeWindowEndsAt) {
      cards.push(
        <DealCountdown
          key="window"
          to={r.disputeWindowEndsAt}
          label="Dispute window closes in"
          elapsedLabel="Window closed"
          hint="then the deposit is released automatically"
          onElapsed={onDeadline}
          tone="attention"
        />,
      )
    }
    if (r.handoverAt && r.payoutAt && !r.payoutReleasedAt && r.phase !== 'missing') {
      cards.push(
        <DealCountdown
          key="payout"
          to={r.payoutAt}
          label="Owner payout in"
          elapsedLabel={r.phase === 'disputed' ? 'On hold' : 'Paying out…'}
          hint={r.phase === 'disputed' ? 'held until the dispute is resolved' : 'rental fee to the owner'}
          onElapsed={onDeadline}
        />,
      )
    }
    if (r.phase === 'active' && r.handoverAt) {
      cards.push(
        <DealCountdown
          key="due"
          to={r.dueDate}
          label="Due back in"
          elapsedLabel="Due now"
          hint="late days are charged from the deposit"
          onElapsed={onDeadline}
        />,
      )
    }
    if (r.phase === 'overdue') {
      const days = daysLate(new Date(r.dueDate), new Date(now))
      cards.push(
        <div key="overdue" className="border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="label-tag flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Overdue
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {days} {days === 1 ? 'day' : 'days'} late
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Was due {formatDateTime(r.dueDate)}</p>
        </div>,
      )
    }
  } else {
    const t = deal.transaction
    if (t.status === 'handed-over' && t.disputeWindowEndsAt) {
      cards.push(
        <DealCountdown
          key="window"
          to={t.disputeWindowEndsAt}
          label="Window closes · seller paid in"
          elapsedLabel="Window closed"
          hint="then the money is released to the seller"
          onElapsed={onDeadline}
          tone="attention"
        />,
      )
    }
  }
  if (cards.length === 0) return null
  return <div className="grid gap-4 sm:grid-cols-2">{cards}</div>
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function ActionsPanel({
  deal,
  role,
  dispute,
  otherName,
  now,
  reload,
  onRate,
  review,
}: {
  deal: Deal
  role: DealRole
  dispute: Dispute | null
  otherName: string
  now: number
  reload: () => Promise<void>
  onRate?: () => void
  review: Review | null
}) {
  const { cancelRental, confirmHandover, markReturned, markSold } = useMarketplace()
  const [busy, setBusy] = useState(false)
  const id = dealId(deal)

  const run = async (action: () => Promise<unknown>, success: string, description?: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(success, description ? { description } : undefined)
      await reload()
    } catch (error) {
      toast.error('That didn’t work', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const items: React.ReactNode[] = []
  const note = (text: string) => items.push(<p key={`note-${items.length}`} className="text-[13px] text-muted-foreground">{text}</p>)
  const linkButton = (href: string, label: string, variant: 'default' | 'outline' | 'destructive' = 'default') =>
    items.push(
      <Link key={href + label} href={href} className={cn(buttonVariants({ variant }), 'h-10 justify-between px-4 text-[13px]')}>
        {label} <ArrowRight className="h-4 w-4" />
      </Link>,
    )

  if (role === 'viewer') {
    note('You are viewing this deal as an admin. Only the two parties can act on it.')
  } else if (deal.kind === 'rental') {
    const r = deal.rental
    const kind = { kind: 'rental' as const, id }
    switch (r.phase) {
      case 'requested':
        if (role === 'owner') linkButton(`/dashboard/listings/${r.listingId}/requests`, 'Review the request')
        else note('Waiting for the owner to approve your request. Nothing is charged until you pay.')
        items.push(
          <Button key="cancel" variant="outline" className="h-10" disabled={busy}
            onClick={() => run(() => cancelRental(id), 'Request cancelled')}>
            Cancel request
          </Button>,
        )
        break
      case 'approved':
        if (role === 'renter') linkButton(`/listing/${r.listingId}/checkout?rental=${id}`, 'Pay to confirm the booking')
        else note('Approved. Waiting for the renter to pay.')
        items.push(
          <Button key="cancel" variant="outline" className="h-10" disabled={busy}
            onClick={() => run(() => cancelRental(id), 'Booking cancelled')}>
            Cancel booking
          </Button>,
        )
        break
      case 'paid':
        items.push(
          <PhotoAction
            key="handover"
            title="Confirm the handover"
            description={`Take photos of the item's condition at pickup. The due date and the owner's ${OWNER_PAYOUT_DELAY_HOURS}-hour payout clock start now.`}
            button="Confirm handover"
            requirePhotos
            busy={busy}
            onSubmit={(photos) =>
              run(async () => confirmHandover(id, await uploadPhotos(kind, photos)), 'Handover confirmed')
            }
          />,
        )
        break
      case 'active':
      case 'overdue':
        if (role === 'owner') linkButton(`/transaction/${id}/confirm`, 'Confirm return & condition')
        items.push(
          <PhotoAction
            key="return"
            title={role === 'renter' ? 'I’ve returned the item' : 'Record the return only'}
            description={
              role === 'renter'
                ? `Add at least one photo of the condition at return. Any late fee is fixed now and the ${DISPUTE_WINDOW_HOURS}-hour window opens.`
                : `Add at least one photo of the condition at return. Records the return without releasing the deposit, so you have ${DISPUTE_WINDOW_HOURS} hours to inspect it and file a claim.`
            }
            button="Mark as returned"
            variant="outline"
            requirePhotos
            busy={busy}
            onSubmit={(photos) => run(async () => markReturned(id, await uploadPhotos(kind, photos)), 'Return recorded')}
          />,
        )
        break
      case 'return-pending':
        if (role === 'owner') linkButton(`/transaction/${id}/confirm`, 'Confirm condition & release deposit')
        else note(`Waiting for the owner to confirm the condition. With no claim, your deposit is released when the ${DISPUTE_WINDOW_HOURS}-hour window closes.`)
        if (canFileDispute(deal, role, now)) linkButton(fileDisputeHref(deal), 'File a dispute', 'destructive')
        break
      case 'disputed':
        note('A dispute is open. An admin reviews the chat history and the photos; the deposit stays held.')
        break
      case 'declined':
      case 'cancelled':
        note('This booking is closed. No money moved.')
        break
    }
  } else {
    const t = deal.transaction
    if (t.mode === 'in-person') {
      if (t.status === 'pending') {
        if (role === 'seller') {
          items.push(
            <Button key="sold" className="h-10" disabled={busy}
              onClick={() => run(() => markSold(t.listingId, t.buyerId), 'Marked as sold', `Sold to ${otherName}.`)}>
              Mark as sold to {otherName}
            </Button>,
          )
        } else {
          note('Pay the seller at pickup. The seller then marks the item sold.')
        }
        items.push(
          <Button key="cancel" variant="outline" className="h-10" disabled={busy}
            onClick={() => run(() => cancelSale(id), 'Purchase cancelled')}>
            Cancel
          </Button>,
        )
      } else if (t.status === 'cancelled') {
        note('This purchase was cancelled.')
      }
    } else {
      const kind = { kind: 'sale' as const, id }
      if (t.status === 'paid') {
        if (role === 'buyer') linkButton(`/transaction/${id}/confirm`, 'I have the item: confirm receipt')
        items.push(
          <PhotoAction
            key="handover"
            title="Confirm the handover"
            description={`Opens the ${DISPUTE_WINDOW_HOURS}-hour window. The money is released to the seller when it closes, unless the buyer disputes.`}
            button="Confirm handover"
            variant={role === 'buyer' ? 'outline' : 'default'}
            busy={busy}
            onSubmit={(photos) =>
              run(async () => confirmSaleHandover(id, await uploadPhotos(kind, photos)), 'Handover confirmed')
            }
          />,
        )
      } else if (t.status === 'handed-over') {
        if (role === 'buyer') {
          linkButton(`/transaction/${id}/confirm`, 'Confirm receipt & release now')
          if (canFileDispute(deal, role, now)) linkButton(fileDisputeHref(deal), 'File a dispute', 'destructive')
        } else {
          note(`Handed over. You are paid when the ${DISPUTE_WINDOW_HOURS}-hour window closes, or sooner if the buyer confirms.`)
        }
      } else if (t.status === 'disputed') {
        note('A dispute is open. An admin reviews the chat and photos; the money stays held.')
      }
    }
  }

  if (dispute) {
    items.push(
      <Link key="dispute" href={disputeHref(dispute.id)} className={cn(buttonVariants({ variant: 'outline' }), 'h-10 justify-between px-4 text-[13px]')}>
        {dispute.status === 'open' ? 'View the open dispute' : 'View the dispute outcome'} <ArrowRight className="h-4 w-4" />
      </Link>,
    )
  }

  if (isDealClosed(deal) && role !== 'viewer') {
    if (review) {
      items.push(
        <p key="rated" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Star className="h-4 w-4 text-surge" fill="currentColor" />
          You rated {otherName} {review.rating} / 5.
        </p>,
      )
    } else if (onRate) {
      items.push(
        <Button key="rate" className="h-10" onClick={onRate} data-testid="rate-button">
          <Star className="h-4 w-4" /> Rate {otherName}
        </Button>,
      )
    }
  }

  if (items.length === 0) return null
  return (
    <section className="border border-border bg-card p-6" data-testid="actions">
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold">
        <Handshake className="h-4 w-4 text-primary" /> What you can do now
      </h2>
      <div className="grid gap-3">{items}</div>
    </section>
  )
}

function PhotoAction({
  title,
  description,
  button,
  busy,
  onSubmit,
  variant = 'default',
  requirePhotos = false,
}: {
  title: string
  description: string
  button: string
  busy: boolean
  onSubmit: (photos: PickedPhoto[]) => Promise<void>
  variant?: 'default' | 'outline'
  /** Rental returns need condition photos (BusinessRules §4, §9). */
  requirePhotos?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const missingPhotos = requirePhotos && photos.length === 0
  if (!open) {
    return (
      <Button variant={variant} className="h-10" onClick={() => setOpen(true)}>
        {title}
      </Button>
    )
  }
  return (
    <div className="space-y-3 border border-border bg-surface p-4">
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="text-[12px] text-muted-foreground">{description}</p>
      <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} label="Condition photo" />
      {missingPhotos && (
        <p className="text-[11px] text-muted-foreground" data-testid="photos-required">
          Rental returns need at least one photo of the item&apos;s condition.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          className="h-9"
          disabled={busy || missingPhotos}
          onClick={async () => {
            await onSubmit(photos)
            setPhotos([])
          }}
        >
          {busy ? 'Saving…' : button}
        </Button>
        <Button variant="ghost" className="h-9" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-5" data-testid="timeline">
      {steps.map((s, index) => {
        const Icon = s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : s.state === 'stopped' ? XCircle : Circle
        return (
          <li key={s.key} className="relative flex gap-4" data-state={s.state}>
            {index < steps.length - 1 && (
              <span
                className={cn('absolute left-[9px] top-6 h-[calc(100%-4px)] w-px', s.state === 'done' ? 'bg-primary/40' : 'bg-border')}
                aria-hidden="true"
              />
            )}
            <Icon
              className={cn(
                'relative z-10 mt-0.5 h-[19px] w-[19px] shrink-0 bg-card',
                s.state === 'done' && 'text-primary',
                s.state === 'current' && 'text-amber-600 dark:text-amber-400',
                s.state === 'stopped' && 'text-destructive',
                s.state === 'upcoming' && 'text-muted-foreground/40',
              )}
            />
            <div className={cn('min-w-0', s.state === 'upcoming' && 'opacity-60')}>
              <p className="text-[13px] font-semibold">{s.title}</p>
              {s.at && (
                <p className="text-[11px] text-muted-foreground">
                  {s.atKind === 'due' && s.state !== 'done' ? 'Due ' : ''}
                  {formatDateTime(s.at)}
                </p>
              )}
              {s.detail && <p className="mt-0.5 text-[12px] text-muted-foreground">{s.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Amounts ─────────────────────────────────────────────────────────────────

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', strong && 'border-t border-border pt-2')}>
      <dt className={cn(strong ? 'font-semibold' : 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'font-display font-semibold' : 'font-medium', muted && 'text-muted-foreground')}>
        {value}
      </dd>
    </div>
  )
}

function AmountsCard({ deal, role, now }: { deal: Deal; role: DealRole; now: number }) {
  if (deal.kind === 'rental') {
    const r = deal.rental
    const total = r.totalPaid ?? r.quote?.totalDueNow ?? r.rentalFee + r.commission + r.escrowFee + r.deposit
    const settled = r.depositToOwner !== undefined || r.depositToRenter !== undefined
    const overdueSoFar =
      r.phase === 'overdue'
        ? (() => {
            const perDay = dailyLateFee(r.rentalFee, r.rentalPeriod)
            const days = daysLate(new Date(r.dueDate), new Date(now))
            return { perDay, days, ...settleDeposit(r.deposit, perDay * days) }
          })()
        : null
    return (
      <section className="border border-border bg-card p-6" data-testid="amounts">
        <p className="label-tag mb-3">{r.paidAt ? 'Paid by the renter' : 'Due at payment'}</p>
        <dl className="space-y-1.5 text-[13px]">
          <Row label={`Rental fee${r.rentalPeriod ? ` (${r.rentalPeriod})` : ''}`} value={formatPrice(r.rentalFee)} />
          <Row label={`Commission (${Math.round(RENTAL_COMMISSION_RATE * 100)}%)`} value={formatPrice(r.commission)} />
          <Row label="Escrow handling fee" value={formatPrice(r.escrowFee)} />
          <Row label="Refundable deposit" value={formatPrice(r.deposit)} />
          <Row label={r.paidAt ? 'Total paid' : 'Total due'} value={formatPrice(total)} strong />
        </dl>
        {r.paymentMethod && (
          <p className="mt-2 text-[11px] text-muted-foreground">Paid by {methodLabel(r.paymentMethod)}</p>
        )}

        <p className="label-tag mb-3 mt-6">{role === 'owner' ? 'You receive' : 'Where the money goes'}</p>
        <dl className="space-y-1.5 text-[13px]">
          <Row
            label={`Rental fee to the owner${r.payoutReleasedAt ? ' · paid' : r.handoverAt ? ' · pending' : ''}`}
            value={formatPrice(r.rentalFee)}
          />
          {settled ? (
            <>
              {r.lateFee > 0 && <Row label={`Late fee (${r.lateDays} d)`} value={formatPrice(r.lateFee)} />}
              <Row label="Deposit to the owner" value={formatPrice(r.depositToOwner ?? 0)} />
              <Row label="Deposit refunded to the renter" value={formatPrice(r.depositToRenter ?? 0)} />
            </>
          ) : overdueSoFar ? (
            <>
              <Row label={`Late fee so far (${overdueSoFar.days} d × ${formatPrice(overdueSoFar.perDay)})`} value={formatPrice(overdueSoFar.toOwner)} />
              <Row label="Deposit left for the renter" value={formatPrice(overdueSoFar.toRenter)} muted />
            </>
          ) : r.returnedAt ? (
            <>
              {r.lateFee > 0 && <Row label={`Late fee (${r.lateDays} d)`} value={formatPrice(r.lateFee)} />}
              <Row label="Deposit held until settled" value={formatPrice(r.deposit)} muted />
            </>
          ) : (
            <Row label={r.paidAt ? 'Deposit held by Pass It On' : 'Deposit (held after payment)'} value={formatPrice(r.deposit)} muted />
          )}
        </dl>
      </section>
    )
  }

  const t = deal.transaction
  if (t.mode === 'in-person') {
    return (
      <section className="border border-border bg-card p-6" data-testid="amounts">
        <p className="label-tag mb-3">Price</p>
        <dl className="space-y-1.5 text-[13px]">
          <Row label="Paid directly to the seller" value={formatPrice(t.price)} strong />
        </dl>
        <p className="mt-2 text-[11px] text-muted-foreground">No fee, no escrow, no protection.</p>
      </section>
    )
  }
  const settled = t.status === 'released' || t.status === 'resolved'
  return (
    <section className="border border-border bg-card p-6" data-testid="amounts">
      <p className="label-tag mb-3">Paid with protection</p>
      <dl className="space-y-1.5 text-[13px]">
        <Row label="Item price" value={formatPrice(t.price)} />
        <Row label="Buyer protection fee" value={formatPrice(t.protectionFee)} />
        <Row label="Total paid" value={formatPrice(t.total)} strong />
      </dl>
      {t.paymentMethod && <p className="mt-2 text-[11px] text-muted-foreground">Paid by {methodLabel(t.paymentMethod)}</p>}
      <p className="label-tag mb-3 mt-6">{role === 'seller' ? 'You receive' : 'Where the money goes'}</p>
      <dl className="space-y-1.5 text-[13px]">
        {settled ? (
          <>
            <Row label="Released to the seller" value={formatPrice(t.sellerAmount ?? t.price)} />
            {t.refundToBuyer > 0 && <Row label="Refunded to the buyer" value={formatPrice(t.refundToBuyer)} />}
          </>
        ) : (
          <Row label="Held for the seller" value={formatPrice(t.price)} muted />
        )}
      </dl>
    </section>
  )
}

function methodLabel(method: string) {
  return method === 'promptpay' ? 'PromptPay' : method === 'card' ? 'card' : 'wallet balance'
}

// ─── Photos ──────────────────────────────────────────────────────────────────

function PhotosSection({ deal }: { deal: Deal }) {
  const handover = deal.kind === 'rental' ? deal.rental.handoverPhotos : deal.transaction.handoverPhotos
  const returned = deal.kind === 'rental' ? deal.rental.returnPhotos : []
  if (handover.length === 0 && returned.length === 0) return null
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="mb-4 text-[15px] font-semibold">Condition photos</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="label-tag mb-2">At handover</p>
          <EvidenceGallery paths={handover} emptyLabel="No handover photos." />
        </div>
        {deal.kind === 'rental' && (
          <div>
            <p className="label-tag mb-2">At return</p>
            <EvidenceGallery paths={returned} emptyLabel="No return photos yet." />
          </div>
        )}
      </div>
    </section>
  )
}
