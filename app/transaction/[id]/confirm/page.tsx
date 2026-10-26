'use client'

// Early release (BusinessRules §6: "Confirming early releases them at once").
//
// - Protected sale, buyer: confirm receipt → confirm_sale_receipt; the seller
//   is paid now and the dispute window closes (figures/buyer_userflow.png S→T).
// - Rental, owner: confirm the return condition with photos, compared with
//   the handover photos → confirm_return; the deposit minus any late fee goes
//   back to the renter now (figures/owner_userflow.png P→S).
//
// Afterwards the transaction page opens with the rating dialog (?review=1).
//
// Live: if the other party acts meanwhile (e.g. files a dispute), the deal is
// reloaded and the form is replaced by the matching "nothing to confirm" note.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import {
  confirmSaleReceipt,
  getDeal,
  getListing,
  subscribeToRentals,
  subscribeToTransactions,
  type Deal,
} from '@/lib/api'
import type { Listing, Rental, Transaction } from '@/lib/types'
import { useMarketplace } from '@/lib/store'
import { DISPUTE_WINDOW_HOURS, MISSING_AFTER_DAYS, SALE_COMMISSION_RATE, lateReturnSettlement } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { canFileDispute, dealRole, fileDisputeHref, formatDateTime } from '@/lib/deal-status'
import { Button, buttonVariants } from '@/components/ui/button'
import { useNow } from '@/components/deal-countdown'
import { EvidenceGallery, PhotoPicker, uploadPhotos, type PickedPhoto } from '@/components/evidence-photos'
import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'
import { cn } from '@/lib/utils'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; deal: Deal | null; listing: Listing | null }

export default function ConfirmTransactionPage() {
  const { id } = useParams<{ id: string }>()
  const { currentUserId } = useMarketplace()
  const [state, setState] = useState<State>({ status: 'loading' })
  // While our own submit runs, its realtime echo must not swap the form out
  // before the redirect to the deal page.
  const submitting = useRef(false)
  const setSubmitting = useCallback((value: boolean) => {
    submitting.current = value
  }, [])

  const load = useCallback(async (): Promise<State> => {
    try {
      const deal = await getDeal(id)
      const listing = deal
        ? await getListing(deal.kind === 'rental' ? deal.rental.listingId : deal.transaction.listingId).catch(() => null)
        : null
      return { status: 'ready', deal, listing }
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }, [id])

  const reload = useCallback(async () => {
    if (submitting.current) return
    const next = await load()
    if (!submitting.current) setState(next)
  }, [load])

  useEffect(() => {
    let cancelled = false
    load().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  // The other party may act while the form is open (dispute, return, …).
  useEffect(() => {
    const onChange = (changed: { id: string }) => {
      if (changed.id === id) void reload()
    }
    const unsubscribers = [subscribeToRentals(onChange), subscribeToTransactions(onChange)]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [id, reload])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-14">
      <Link
        href={`/transaction/${id}`}
        className="mb-8 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the deal
      </Link>
      {state.status === 'loading' && <p className="text-[13px] text-muted-foreground">Loading…</p>}
      {state.status === 'error' && <Nothing title="Could not load this deal" body={state.message} id={id} />}
      {state.status === 'ready' && !state.deal && (
        <Nothing title="Deal not found" body="It may not exist, or you are not a party to it." id={id} />
      )}
      {state.status === 'ready' && state.deal && (
        <ConfirmBody
          deal={state.deal}
          listing={state.listing}
          userId={currentUserId}
          flow={{ setSubmitting, reload }}
        />
      )}
    </div>
  )
}

/** Lets a form pause live reloads while it submits, and re-check the deal
 *  after a refusal (the state may have moved on). */
type Flow = { setSubmitting: (value: boolean) => void; reload: () => Promise<void> }

function ConfirmBody({
  deal,
  listing,
  userId,
  flow,
}: {
  deal: Deal
  listing: Listing | null
  userId: string | null
  flow: Flow
}) {
  const role = dealRole(deal, userId)
  if (deal.kind === 'sale') {
    const t = deal.transaction
    if (t.mode !== 'protected') {
      return <Nothing title="Nothing to confirm" body="Sales paid in person have no escrow: the seller marks the item sold." id={t.id} />
    }
    if (role !== 'buyer') {
      return <Nothing title="Only the buyer confirms receipt" body={`The money is released when the buyer confirms, or ${DISPUTE_WINDOW_HOURS} hours after handover.`} id={t.id} />
    }
    if (t.status !== 'paid' && t.status !== 'handed-over') {
      return <Nothing title="Already settled" body="This purchase is no longer held in escrow." id={t.id} />
    }
    return <ConfirmReceipt transaction={t} listing={listing} deal={deal} flow={flow} />
  }
  const r = deal.rental
  if (role !== 'owner') {
    return <Nothing title="Only the owner confirms the return" body={`With no claim, the deposit is released ${DISPUTE_WINDOW_HOURS} hours after the return.`} id={r.id} />
  }
  if (!['active', 'overdue', 'return-pending'].includes(r.phase)) {
    return <Nothing title="Nothing to confirm" body="This rental is not waiting for a return." id={r.id} />
  }
  return <ConfirmReturn rental={r} listing={listing} deal={deal} flow={flow} />
}

function Nothing({ title, body, id }: { title: string; body: string; id: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      <Link href={`/transaction/${id}`} className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
        Back to the deal
      </Link>
    </div>
  )
}

// ─── Protected sale: buyer confirms receipt ──────────────────────────────────

function ConfirmReceipt({
  transaction: t,
  listing,
  deal,
  flow,
}: {
  transaction: Transaction
  listing: Listing | null
  deal: Deal
  flow: Flow
}) {
  const router = useRouter()
  const now = useNow(30_000)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    flow.setSubmitting(true)
    try {
      await confirmSaleReceipt(t.id)
      toast.success('Payment released to the seller', { description: `${formatPrice(t.price)} (simulated).` })
      router.push(`/transaction/${t.id}?review=1`)
    } catch (error) {
      toast.error('Could not confirm receipt', { description: error instanceof Error ? error.message : String(error) })
      setSubmitting(false)
      flow.setSubmitting(false)
      void flow.reload()
    }
  }

  return (
    <>
      <p className="label-tag mb-2">Protected purchase</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Confirm receipt</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {listing?.title ?? 'Your item'} · release {formatPrice(t.price - t.sellerCommission)} to the seller now instead of waiting for the{' '}
        {DISPUTE_WINDOW_HOURS}-hour window
        {t.disputeWindowEndsAt ? ` (closes ${formatDateTime(t.disputeWindowEndsAt)})` : ''}.
      </p>

      <div className="mt-8 border border-border bg-card p-6 md:p-8">
        <div className="mb-6 flex items-start gap-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Confirming means you have inspected the item and accept it. <strong className="text-foreground">The
            seller is paid at once</strong> and you can no longer open a dispute. This can&apos;t be undone.
          </p>
        </div>

        <dl className="mb-6 space-y-1.5 text-[13px]">
          <div className="flex justify-between"><dt className="text-muted-foreground">Released to the seller</dt><dd className="font-medium tabular-nums">{formatPrice(t.price - t.sellerCommission)}</dd></div>
          {t.sellerCommission > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Sale commission ({Math.round(SALE_COMMISSION_RATE * 100)}%, from the seller)</dt><dd className="font-medium tabular-nums">{formatPrice(t.sellerCommission)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Buyer protection fee (kept)</dt><dd className="font-medium tabular-nums">{formatPrice(t.protectionFee)}</dd></div>
          <div className="flex justify-between border-t border-border pt-1.5"><dt className="font-semibold">You paid</dt><dd className="font-display font-semibold tabular-nums">{formatPrice(t.total)}</dd></div>
        </dl>

        <form onSubmit={submit} className="space-y-6">
          <label className="flex cursor-pointer items-start gap-4 border border-border bg-surface p-5 transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              required
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-[14px] font-semibold">I have received and inspected the item</span>
              <span className="mt-1 block text-[12px] text-muted-foreground">It matches the description.</span>
            </span>
          </label>
          <Button type="submit" disabled={!checked || submitting} className="h-11 w-full text-[13px] font-semibold">
            {submitting ? 'Releasing…' : `Confirm & release ${formatPrice(t.price)}`}
          </Button>
          <SimulatedPaymentsNote />
        </form>
      </div>

      {canFileDispute(deal, 'buyer', now) && (
        <p className="mt-6 text-[12px] text-muted-foreground">
          Not as described?{' '}
          <Link href={fileDisputeHref(deal)} className="font-semibold text-destructive hover:underline">
            File a dispute instead
          </Link>{' '}
          before the window closes.
        </p>
      )}
    </>
  )
}

// ─── Rental: owner confirms the return condition ─────────────────────────────

function ConfirmReturn({
  rental: r,
  listing,
  deal,
  flow,
}: {
  rental: Rental
  listing: Listing | null
  deal: Deal
  flow: Flow
}) {
  const router = useRouter()
  const { confirmReturn } = useMarketplace()
  const now = useNow(30_000)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // The late fee is fixed at the return (mark_returned). If the return isn't
  // recorded yet, confirm_return records it now: preview with lib/fees.ts.
  const preview = r.returnedAt
    ? { toOwner: r.lateFee, toRenter: r.deposit - r.lateFee, daysLate: r.lateDays, status: 'recorded' as const }
    : lateReturnSettlement({
        deposit: r.deposit,
        rentalFee: r.rentalFee,
        rentalPeriod: r.rentalPeriod,
        dueDate: new Date(r.dueDate),
        returnedAt: new Date(now),
      })
  const missing = preview.status === 'missing'
  // Rental returns need condition photos (BusinessRules §4, §9): photos taken
  // at mark_returned count, otherwise the owner adds at least one now.
  const needsPhotos = r.returnPhotos.length === 0 && photos.length === 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (needsPhotos) return
    setSubmitting(true)
    flow.setSubmitting(true)
    try {
      const paths = await uploadPhotos({ kind: 'rental', id: r.id }, photos)
      const updated = await confirmReturn(r.id, paths)
      toast.success(updated.phase === 'released' ? 'Deposit released' : 'Return recorded', {
        description:
          updated.phase === 'released'
            ? `${formatPrice(updated.depositToRenter ?? 0)} back to the renter (simulated).`
            : undefined,
      })
      router.push(`/transaction/${r.id}?review=1`)
    } catch (error) {
      toast.error('Could not confirm the return', { description: error instanceof Error ? error.message : String(error) })
      setSubmitting(false)
      flow.setSubmitting(false)
      void flow.reload()
    }
  }
  return (
    <>
      <p className="label-tag mb-2">Rental return</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Confirm the return condition</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {listing?.title ?? 'Your item'} · compare the item with the handover photos. Confirming releases the deposit
        to the renter at once.
        {r.disputeWindowEndsAt ? ` With no action it releases automatically ${formatDateTime(r.disputeWindowEndsAt)}.` : ''}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="border border-border bg-card p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Before and after</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="label-tag mb-2">At handover</p>
              <EvidenceGallery paths={r.handoverPhotos} emptyLabel="No handover photos were taken." />
              {r.handoverAt && <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(r.handoverAt)}</p>}
            </div>
            <div>
              <p className="label-tag mb-2">At return</p>
              {r.returnPhotos.length > 0 && <EvidenceGallery paths={r.returnPhotos} className="mb-2" />}
              <PhotoPicker photos={photos} onChange={setPhotos} disabled={submitting} label="Return photo" />
              <p
                className={cn('mt-2 text-[11px]', needsPhotos ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}
                data-testid="photos-required"
              >
                {r.returnPhotos.length > 0
                  ? 'Add more photos of the condition now if anything looks different (optional).'
                  : 'Required: add at least one photo of the condition now, to compare with the handover photos.'}
              </p>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Deposit settlement</h2>
          {missing ? (
            <p className="text-[13px] text-destructive">
              This rental is more than {MISSING_AFTER_DAYS} days late, so it counts as missing and the full deposit goes
              to you. Recording the return now settles it that way.
            </p>
          ) : (
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted-foreground">Deposit held</dt><dd className="font-medium tabular-nums">{formatPrice(r.deposit)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Late fee to you{preview.daysLate > 0 ? ` (${preview.daysLate} ${preview.daysLate === 1 ? 'day' : 'days'} late)` : ''}
                </dt>
                <dd className="font-medium tabular-nums">{formatPrice(preview.toOwner)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="font-semibold">Refunded to the renter</dt>
                <dd className="font-display font-semibold tabular-nums">{formatPrice(preview.toRenter)}</dd>
              </div>
            </dl>
          )}
          {!r.returnedAt && !missing && (
            <p className="mt-2 text-[11px] text-muted-foreground">The late fee is fixed by the server at the moment you confirm.</p>
          )}
        </section>

        <label className="flex cursor-pointer items-start gap-4 border border-border bg-surface p-5 transition-colors hover:bg-muted/50">
          <input
            type="checkbox"
            required
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block text-[14px] font-semibold">The item came back in good condition</span>
            <span className="mt-1 block text-[12px] text-muted-foreground">Normal wear only. This can&apos;t be undone.</span>
          </span>
        </label>

        <div className="space-y-3">
          <Button
            type="submit"
            disabled={!checked || needsPhotos || submitting}
            className="h-11 w-full text-[13px] font-semibold"
          >
            {submitting ? 'Releasing…' : missing ? 'Record the return' : `Confirm & refund ${formatPrice(preview.toRenter)}`}
          </Button>
          <SimulatedPaymentsNote />
        </div>
      </form>

      <p className="mt-6 text-[12px] text-muted-foreground">
        Found damage?{' '}
        {canFileDispute(deal, 'owner', now) ? (
          <Link href={fileDisputeHref(deal)} className="font-semibold text-destructive hover:underline">
            File a dispute
          </Link>
        ) : (
          <Link href={`/transaction/${r.id}`} className="font-semibold text-primary hover:underline">
            Record the return first
          </Link>
        )}{' '}
        within {DISPUTE_WINDOW_HOURS} hours of the return instead. An admin decides; you can never receive more than the
        deposit.
      </p>
    </>
  )
}
