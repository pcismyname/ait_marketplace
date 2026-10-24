'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Camera,
  CircleCheck,
  Clock,
  HandCoins,
  MessageCircle,
  PackageCheck,
  Scale,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react'
import { getDisputeFor } from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import { BRAND, paymentMethodLabel } from '@/lib/data'
import { DISPUTE_WINDOW_HOURS, MISSING_AFTER_DAYS, OWNER_PAYOUT_DELAY_HOURS, dailyLateFee } from '@/lib/fees'
import { formatPrice, initials, relativeTime } from '@/lib/format'
import type { Dispute, Listing, Rental } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { RateDealButton } from '@/components/rate-deal-button'
import { EvidencePhotos } from './evidence-photos'
import { PhotoActionDialog } from './photo-action-dialog'
import { RespondRequestActions, approveBlockedReason } from './respond-request-actions'
import {
  PHASE_META,
  TONE_CLASS,
  disputeHref,
  formatDateTime,
  formatDay,
  hasPhotosFrom,
  lateSoFar,
  missingAfter,
  newDisputeHref,
  rentalQuote,
  timeLeft,
  type RentalRole,
} from './rental-helpers'

/**
 * One booking, as the renter or the owner sees it. Every state change is an
 * RPC through the store (lib/api/rentals.ts); amounts come from the rental's
 * columns or lib/fees.ts, deadlines from its timestamp columns.
 */
export function RentalCard({
  rental,
  role,
  listing,
  now,
  reviewed,
  onRated,
}: {
  rental: Rental
  role: RentalRole
  listing: Listing | undefined
  now: Date
  /** Whether the viewer already rated this (closed) rental; undefined while loading (useReviewedDeals). */
  reviewed?: boolean
  onRated?: () => void
}) {
  const { getUser, rentals, threads, cancelRental, confirmHandover, markReturned, confirmReturn } = useMarketplace()
  const [busy, setBusy] = useState(false)
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const other = getUser(role === 'renter' ? rental.ownerId : rental.renterId)
  const firstName = other.name.split(' ')[0]
  const meta = PHASE_META[rental.phase]
  const quote = rentalQuote(rental)
  const title = listing?.title ?? 'Rental item'
  const image = listing?.images[0]
  const pickup = listing?.pickupLocation
  const otherId = role === 'renter' ? rental.ownerId : rental.renterId
  const thread = threads.find((t) => t.listingId === rental.listingId && t.participantIds.includes(otherId))
  const chatHref = thread ? `/chat?thread=${encodeURIComponent(thread.id)}` : '/chat'

  useEffect(() => {
    if (rental.phase !== 'disputed' && rental.phase !== 'resolved') return
    let cancelled = false
    getDisputeFor({ rentalId: rental.id }).then(
      (d) => !cancelled && setDispute(d),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [rental.id, rental.phase])

  const run = async (action: () => Promise<unknown>, success: string, description?: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(success, description ? { description } : undefined)
    } catch (error) {
      toast.error('Could not update the rental', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const disputeLeft = timeLeft(rental.disputeWindowEndsAt, now)
  const payoutLeft = timeLeft(rental.payoutAt, now)
  const dueLeft = timeLeft(rental.dueDate, now)
  const late = rental.phase === 'overdue' ? lateSoFar(rental, now) : null
  const perDayLateFee = dailyLateFee(rental.rentalFee, rental.rentalPeriod)

  // ── Status text and actions per phase ─────────────────────────────────────
  let status: ReactNode = null
  let actions: ReactNode = null

  const cancelButton = (label: string) => (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={() => run(() => cancelRental(rental.id), 'Booking cancelled', `${firstName} has been notified.`)}
    >
      {label}
    </Button>
  )

  const handoverDialog = (
    <PhotoActionDialog
      rentalId={rental.id}
      requirePhotos
      title="Confirm the handover"
      description={`Take photos of the item's condition now. The rental period (${rental.periodDays} days) starts at handover, and ${firstName} is notified.`}
      confirmLabel="Confirm handover"
      onConfirm={async (paths) => {
        const updated = await confirmHandover(rental.id, paths)
        toast.success('Handover confirmed', {
          description: `Return it by ${formatDay(updated.dueDate)}. The owner's rental fee pays out ${formatDateTime(updated.payoutAt)}.`,
        })
      }}
      trigger={
        <Button size="sm">
          <Camera className="h-3.5 w-3.5" />
          Confirm handover
        </Button>
      }
    />
  )

  const markReturnedDialog = (
    <PhotoActionDialog
      rentalId={rental.id}
      requirePhotos
      title="Mark the item as returned"
      description={`Photograph the item as it is handed back. The late fee (if any) is fixed now, and a ${DISPUTE_WINDOW_HOURS}-hour window opens for either of you to report a problem; with no dispute the deposit releases automatically when it closes.`}
      confirmLabel="Mark returned"
      onConfirm={async (paths) => {
        const updated = await markReturned(rental.id, paths)
        if (updated.phase === 'missing') {
          toast.error('Counted as missing', {
            description: `More than ${MISSING_AFTER_DAYS} days late: the full deposit went to the owner.`,
          })
        } else {
          toast.success('Marked as returned', {
            description:
              updated.lateFee > 0
                ? `${formatPrice(updated.lateFee)} late fee comes out of the deposit. The rest releases ${formatDateTime(updated.disputeWindowEndsAt)} unless a dispute is opened.`
                : `The deposit releases ${formatDateTime(updated.disputeWindowEndsAt)} unless a dispute is opened.`,
          })
        }
      }}
      trigger={
        <Button size="sm" variant={role === 'owner' ? 'outline' : 'default'}>
          <PackageCheck className="h-3.5 w-3.5" />
          Mark returned
        </Button>
      }
    >
      {late && late.toOwner > 0 && (
        <p className="rounded-md bg-surge-surface p-3 text-[12px] text-surge-foreground">
          {late.daysLate} {late.daysLate === 1 ? 'day' : 'days'} late: {formatPrice(late.toOwner)} late fee will be
          taken from the {formatPrice(rental.deposit)} deposit.
        </p>
      )}
    </PhotoActionDialog>
  )

  const ownerHasReturnPhotos = hasPhotosFrom(rental.returnPhotos, rental.ownerId)
  const confirmReturnDialog = (
    <PhotoActionDialog
      rentalId={rental.id}
      requirePhotos={!ownerHasReturnPhotos}
      title="Confirm a good return"
      description="Compare the item with the handover photos. Confirming releases the deposit now; you can't open a dispute afterwards."
      confirmLabel="Confirm & release deposit"
      onConfirm={async (paths) => {
        const updated = await confirmReturn(rental.id, paths)
        if (updated.phase === 'missing') {
          toast.error('Counted as missing', {
            description: `More than ${MISSING_AFTER_DAYS} days late: the full deposit went to you.`,
          })
          return
        }
        toast.success('Deposit released', {
          description:
            (updated.depositToOwner ?? 0) > 0
              ? `${formatPrice(updated.depositToOwner ?? 0)} late fee to you, ${formatPrice(updated.depositToRenter ?? 0)} refunded to ${firstName}.`
              : `${formatPrice(updated.depositToRenter ?? 0)} refunded to ${firstName}.`,
        })
      }}
      trigger={
        <Button size="sm">
          <CircleCheck className="h-3.5 w-3.5" />
          Confirm good return
        </Button>
      }
    >
      <ReleasePreview rental={rental} late={late?.toOwner} />
    </PhotoActionDialog>
  )

  const disputeLink = (
    <Link href={newDisputeHref(rental.id)} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-destructive')}>
      <AlertTriangle className="h-3.5 w-3.5" />
      Open a dispute
    </Link>
  )

  const payoutLine =
    role === 'owner' && rental.handoverAt ? (
      rental.payoutReleasedAt ? (
        <Line icon={Wallet}>
          Rental fee {formatPrice(rental.rentalFee)} paid out to your wallet {formatDateTime(rental.payoutReleasedAt)}.
        </Line>
      ) : rental.phase === 'disputed' && !payoutLeft ? (
        <Line icon={Wallet}>Rental fee {formatPrice(rental.rentalFee)} is paid out when the dispute is resolved.</Line>
      ) : (
        <Line icon={Wallet}>
          Rental fee {formatPrice(rental.rentalFee)} pays out {formatDateTime(rental.payoutAt)}
          {payoutLeft ? <> · <Countdown>{payoutLeft}</Countdown></> : ' (processing)'}.
        </Line>
      )
    ) : null

  switch (rental.phase) {
    case 'requested':
      status =
        role === 'renter' ? (
          <>
            <Line icon={Clock}>
              Waiting for {firstName} to respond · requested {relativeTime(rental.requestedAt)}.
            </Line>
            <Line icon={HandCoins}>
              Once approved you pay {formatPrice(quote.totalDueNow)} ({formatPrice(quote.deposit)} of it is a refundable
              deposit).
            </Line>
          </>
        ) : (
          <Line icon={Clock}>
            {other.name} asked {relativeTime(rental.requestedAt)}. Approving reserves the item for them until they pay.
          </Line>
        )
      actions =
        role === 'renter' ? (
          cancelButton('Cancel request')
        ) : (
          <RespondRequestActions
            rental={rental}
            blockedReason={approveBlockedReason(rental, rentals, listing?.status)}
          />
        )
      break

    case 'approved':
      status =
        role === 'renter' ? (
          <Line icon={CircleCheck}>
            {firstName} approved {relativeTime(rental.approvedAt ?? rental.requestedAt)}. Pay{' '}
            {formatPrice(quote.totalDueNow)} to confirm the booking.
          </Line>
        ) : (
          <Line icon={Clock}>
            Approved. Waiting for {firstName} to pay {formatPrice(quote.totalDueNow)}; the listing is reserved for them.
          </Line>
        )
      actions = (
        <>
          {role === 'renter' && (
            <Link
              href={`/listing/${rental.listingId}/checkout?rental=${rental.id}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Pay {formatPrice(quote.totalDueNow)}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {cancelButton(role === 'renter' ? 'Cancel' : 'Cancel booking')}
        </>
      )
      break

    case 'paid':
      status = (
        <>
          <Line icon={ShieldCheck}>
            {role === 'renter' ? 'You paid' : `${firstName} paid`} {formatPrice(rental.totalPaid ?? quote.totalDueNow)} by{' '}
            {paymentMethodLabel(rental.paymentMethod)} {formatDateTime(rental.paidAt)}. The{' '}
            {formatPrice(rental.deposit)} deposit is held by {BRAND}.
          </Line>
          <Line icon={CalendarClock}>
            Meet{pickup ? ` at ${pickup}` : ''} and confirm the handover with photos. The {rental.periodDays}-day rental
            starts then, and the owner is paid {OWNER_PAYOUT_DELAY_HOURS} hours later.
          </Line>
        </>
      )
      actions = handoverDialog
      break

    case 'active':
      status = (
        <>
          <Line icon={CalendarClock}>
            Due back {formatDay(rental.dueDate)}
            {dueLeft ? <> · <Countdown>{dueLeft}</Countdown></> : ' (checking…)'}. Late returns cost{' '}
            {formatPrice(perDayLateFee)} a day from the deposit.
          </Line>
          {payoutLine}
        </>
      )
      actions = role === 'renter' ? markReturnedDialog : <>{confirmReturnDialog}{markReturnedDialog}</>
      break

    case 'overdue':
      status = (
        <>
          <Line icon={AlertTriangle} tone="warning">
            {late?.daysLate ?? rental.lateDays} {late?.daysLate === 1 ? 'day' : 'days'} late (due {formatDay(rental.dueDate)}) ·{' '}
            {formatPrice(perDayLateFee)}/day. Late fee so far: <strong>{formatPrice(late?.toOwner ?? 0)}</strong> from
            the {formatPrice(rental.deposit)} deposit.
          </Line>
          <Line icon={Clock} tone="warning">
            Counts as missing after {formatDateTime(missingAfter(rental).toISOString())} (more than {MISSING_AFTER_DAYS}{' '}
            days late): the full deposit then goes to the owner.
          </Line>
          {payoutLine}
        </>
      )
      actions = role === 'renter' ? markReturnedDialog : <>{confirmReturnDialog}{markReturnedDialog}</>
      break

    case 'return-pending':
      status = (
        <>
          <Line icon={PackageCheck}>
            Returned {formatDateTime(rental.returnedAt)}
            {rental.lateFee > 0
              ? ` · ${rental.lateDays} ${rental.lateDays === 1 ? 'day' : 'days'} late, ${formatPrice(rental.lateFee)} late fee to the owner`
              : ' on time'}
            .
          </Line>
          <Line icon={ShieldCheck}>
            {formatPrice(rental.deposit - rental.lateFee)} goes back to {role === 'renter' ? 'you' : firstName}{' '}
            {disputeLeft ? (
              <>
                automatically {formatDateTime(rental.disputeWindowEndsAt)} · <Countdown>{disputeLeft} to dispute</Countdown>
              </>
            ) : (
              'now that the window has closed (processing)'
            )}
            {role === 'owner' ? ', or now if you confirm a good return.' : ', unless a dispute is opened.'}
          </Line>
          {payoutLine}
        </>
      )
      actions = (
        <>
          {role === 'owner' && confirmReturnDialog}
          {disputeLeft && disputeLink}
        </>
      )
      break

    case 'disputed':
      status = (
        <>
          <Line icon={Scale} tone="destructive">
            Dispute open{dispute ? ` (“${dispute.reason}”)` : ''}. An admin decides using the chat and the before/after
            photos. The {formatPrice(rental.deposit)} deposit stays held; the owner can never get more than it.
          </Line>
          {payoutLine}
        </>
      )
      actions = dispute ? (
        <Link href={disputeHref(dispute.id)} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          View dispute
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null
      break

    case 'resolved':
      status = (
        <Line icon={Scale}>
          Resolved {formatDateTime(rental.releasedAt)}: {formatPrice(rental.depositToOwner ?? 0)} of the deposit to the
          owner, {formatPrice(rental.depositToRenter ?? 0)} refunded to the renter.
        </Line>
      )
      actions = dispute ? (
        <Link href={disputeHref(dispute.id)} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          View decision
        </Link>
      ) : null
      break

    case 'released':
      status =
        role === 'renter' ? (
          <Line icon={CircleCheck}>
            {formatPrice(rental.depositToRenter ?? 0)} refunded to your wallet {formatDateTime(rental.releasedAt)}
            {(rental.depositToOwner ?? 0) > 0 ? ` (${formatPrice(rental.depositToOwner ?? 0)} late fee to the owner)` : ''}.
          </Line>
        ) : (
          <>
            <Line icon={CircleCheck}>
              Deposit released {formatDateTime(rental.releasedAt)}: {formatPrice(rental.depositToRenter ?? 0)} back to{' '}
              {firstName}
              {(rental.depositToOwner ?? 0) > 0 ? `, ${formatPrice(rental.depositToOwner ?? 0)} late fee to you` : ''}.
            </Line>
            {payoutLine}
          </>
        )
      break

    case 'missing':
      status = (
        <Line icon={AlertTriangle} tone="destructive">
          Not returned within {MISSING_AFTER_DAYS} days of the due date: counted as missing. The full deposit (
          {formatPrice(rental.depositToOwner ?? rental.deposit)}) went to the owner {formatDateTime(rental.releasedAt)}.
        </Line>
      )
      break

    case 'declined':
      status = (
        <Line icon={Clock}>
          Declined {formatDateTime(rental.declinedAt)}
          {rental.declineReason ? `: “${rental.declineReason}”` : '.'} Nothing was paid.
        </Line>
      )
      break

    case 'cancelled':
      status = (
        <Line icon={Clock}>
          Cancelled {formatDateTime(rental.cancelledAt)} before payment
          {rental.declineReason ? `: “${rental.declineReason}”` : '.'} Nothing was paid.
        </Line>
      )
      break
  }

  const closed = ['released', 'resolved', 'missing'].includes(rental.phase)

  return (
    <article
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      data-testid="rental-card"
      data-rental-id={rental.id}
      data-phase={rental.phase}
    >
      <div className="flex gap-4">
        <Link
          href={`/listing/${rental.listingId}`}
          className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-surface-tinted sm:w-24"
        >
          {image && (
            <Image src={image} alt={title} fill className="object-cover" sizes="96px" />
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <span className={cn('label-tag', TONE_CLASS[meta.tone])}>{meta.label}</span>
              <Link
                href={`/listing/${rental.listingId}`}
                className="mt-1 block truncate text-[15px] font-semibold leading-snug hover:underline underline-offset-2"
              >
                {title}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary-muted text-[8px] font-bold text-primary">
                    {initials(other.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {role === 'renter' ? 'From' : 'Rented by'} {other.name}
                  {role === 'owner' && other.program ? ` · ${other.program}` : ''}
                </span>
                {role === 'owner' && other.reviewsCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-current text-primary" />
                    {other.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-[12px] tabular-nums">
              {role === 'renter' ? (
                <>
                  <p className="font-display text-[17px] font-bold">{formatPrice(rental.totalPaid ?? quote.totalDueNow)}</p>
                  <p className="text-muted-foreground">
                    {rental.totalPaid !== undefined ? 'paid' : 'due at booking'} · incl. {formatPrice(rental.deposit)} deposit
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-[17px] font-bold">{formatPrice(rental.rentalFee)}</p>
                  <p className="text-muted-foreground">
                    rental fee {rental.rentalPeriod ?? ''} · {formatPrice(rental.deposit)} deposit
                  </p>
                </>
              )}
            </div>
          </div>

          {rental.requestMessage && (role === 'owner' || rental.phase === 'requested') && (
            <p className="flex gap-2 rounded-md bg-surface p-2.5 text-[12px] italic text-muted-foreground">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic" />
              “{rental.requestMessage}”
            </p>
          )}

          <div className="space-y-1.5">{status}</div>

          <Timeline rental={rental} />

          {(rental.handoverPhotos.length > 0 || rental.returnPhotos.length > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <EvidencePhotos label="Handover photos" paths={rental.handoverPhotos} />
              <EvidencePhotos label="Return photos" paths={rental.returnPhotos} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {actions}
            {closed && onRated && (
              <RateDealButton
                target={{ rentalId: rental.id }}
                subjectName={firstName}
                subjectRole={role === 'renter' ? 'owner' : 'renter'}
                reviewed={reviewed}
                onRated={onRated}
              />
            )}
            <div className="ml-auto flex items-center gap-4">
              <Link
                href={`/transaction/${rental.id}`}
                className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline underline-offset-2"
                data-testid="deal-details"
              >
                Deal details
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {!closed && (
                <Link
                  href={chatHref}
                  className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline underline-offset-2"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Message {firstName}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function ReleasePreview({ rental, late }: { rental: Rental; late?: number }) {
  // In return-pending the late fee is fixed (column); before the return it is the accrued amount so far.
  const lateFee = rental.phase === 'return-pending' ? rental.lateFee : (late ?? 0)
  return (
    <dl className="space-y-1 rounded-md bg-surface p-3 text-[12px]">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Deposit held</dt>
        <dd className="tabular-nums">{formatPrice(rental.deposit)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Late fee to you</dt>
        <dd className="tabular-nums">{formatPrice(lateFee)}</dd>
      </div>
      <div className="flex justify-between font-semibold">
        <dt>Refunded to the renter</dt>
        <dd className="tabular-nums">{formatPrice(rental.deposit - lateFee)}</dd>
      </div>
    </dl>
  )
}

function Line({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Clock
  tone?: 'warning' | 'destructive'
  children: ReactNode
}) {
  return (
    <p
      className={cn(
        'flex gap-2 text-[12.5px] leading-relaxed',
        tone === 'warning' ? 'text-surge-foreground' : tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function Countdown({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-primary-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
      {children}
    </span>
  )
}

const STEPS: { key: keyof Rental; label: string }[] = [
  { key: 'requestedAt', label: 'Requested' },
  { key: 'approvedAt', label: 'Approved' },
  { key: 'paidAt', label: 'Paid' },
  { key: 'handoverAt', label: 'Handed over' },
  { key: 'returnedAt', label: 'Returned' },
  { key: 'releasedAt', label: 'Settled' },
]

/** Progress strip from the rental's timestamp columns. */
function Timeline({ rental }: { rental: Rental }) {
  if (rental.phase === 'declined' || rental.phase === 'cancelled') return null
  return (
    <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px]" aria-label="Booking progress">
      {STEPS.map(({ key, label }) => {
        const at = rental[key] as string | undefined
        return (
          <li
            key={key}
            className={cn('flex items-center gap-1', at ? 'text-foreground' : 'text-muted-foreground/50')}
            title={at ? new Date(at).toLocaleString() : undefined}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', at ? 'bg-primary' : 'bg-border')} />
            {label}
            {at && <span className="text-muted-foreground">{formatDay(at).replace(/, \d{4}$/, '')}</span>}
          </li>
        )
      })}
    </ol>
  )
}
