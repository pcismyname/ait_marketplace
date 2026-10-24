'use client'

// Dispute status for the parties (and admins): status, the deal, the claim,
// evidence (signed URLs) and a discussion thread (BusinessRules §6).
// Older links pass a rental or purchase id here instead of a dispute id: those
// are forwarded to the deal's dispute, or to the filing form.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Gavel, Loader2, Scale, ShieldAlert } from 'lucide-react'
import { getDeal, getDisputeContext, getDisputeFor, type DisputeContext } from '@/lib/api'
import { subscribeToTable } from '@/lib/api/client'
import { useMarketplace } from '@/lib/store'
import { BRAND } from '@/lib/data'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { CommentThread } from '@/components/dispute/comment-thread'
import { DealSummary } from '@/components/dispute/deal-summary'
import { DemoNote } from '@/components/dispute/demo-note'
import { EvidenceGallery } from '@/components/dispute/evidence-gallery'
import { findingLabel, formatDateTime, partyRoles, resolvedSplit } from '@/components/dispute/dispute-helpers'
import { cn } from '@/lib/utils'

export default function DisputePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentUserId, isAdmin, getUser, loading: storeLoading } = useMarketplace()
  const [ctx, setCtx] = useState<DisputeContext | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const context = await getDisputeContext(id)
      if (context) {
        setCtx(context)
        setState('ready')
        return
      }
      // Not a dispute id: maybe a rental or purchase id from an older link.
      const deal = await getDeal(id)
      if (deal) {
        const target = deal.kind === 'rental' ? { rentalId: deal.rental.id } : { transactionId: deal.transaction.id }
        const dispute = await getDisputeFor(target)
        router.replace(
          dispute
            ? `/dispute/${dispute.id}`
            : deal.kind === 'rental'
              ? `/dispute/new?rental=${deal.rental.id}`
              : `/dispute/new?transaction=${deal.transaction.id}`,
        )
        return
      }
      setState('missing')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }, [id, router])

  useEffect(() => {
    if (storeLoading || !currentUserId) return
    // Data fetching on mount; state updates happen after the awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const unsubscribe = subscribeToTable('disputes', () => void load(), `id=eq.${id}`)
    return unsubscribe
  }, [storeLoading, currentUserId, id, load])

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (state !== 'ready' || !ctx) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="label-tag mb-2">Dispute</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dispute not found</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {error ?? 'It may have been removed, or you are not a party to it.'}
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/rentals')}>
          Back to my rentals
        </Button>
      </div>
    )
  }

  const { dispute, rental, transaction, listing, photos } = ctx
  const kind = rental ? 'rental' : 'sale'
  const roles = partyRoles(kind)
  const open = dispute.status === 'open'
  const split = resolvedSplit(dispute)
  const filer = getUser(dispute.filedBy)
  const against = getUser(dispute.againstId)
  const mine = dispute.filedBy === currentUserId
  const ownerId = rental?.ownerId ?? transaction?.sellerId

  const steps = [
    { label: 'Dispute filed', detail: `${mine ? 'You' : filer.name} · ${formatDateTime(dispute.createdAt)}`, done: true },
    {
      label: 'Admin review',
      detail: open ? 'The money stays held in escrow while the admin checks the photos and chat.' : 'Reviewed',
      done: !open,
      current: open,
    },
    {
      label: 'Resolved',
      detail: open ? 'Both of you are notified when it is decided.' : formatDateTime(dispute.resolvedAt),
      done: !open,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-tag mb-2">Dispute</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dispute.reason}</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {listing?.title ?? 'Listing removed'} · filed by {mine ? 'you' : filer.name} against{' '}
            {dispute.againstId === currentUserId ? 'you' : against.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            data-testid="dispute-status"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
              open ? 'bg-destructive/10 text-destructive' : 'bg-primary-muted text-primary',
            )}
          >
            {open ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {open ? 'Open — money held' : 'Resolved'}
          </span>
          {isAdmin && (
            <Link href={`/admin/disputes/${dispute.id}`} className="text-[12px] font-semibold text-primary hover:underline">
              Open in admin
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Status */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-[15px] font-semibold">Status</h2>
            <ol className="space-y-4">
              {steps.map((step) => (
                <li key={step.label} className="flex gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      step.done ? 'bg-primary text-primary-foreground' : step.current ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {step.done ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{step.label}</p>
                    <p className="text-[12px] text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Decision */}
          {!open && split && dispute.finding && (
            <section className="rounded-xl border border-primary/30 bg-primary-muted/40 p-5" data-testid="dispute-decision">
              <div className="mb-3 flex items-center gap-2">
                <Gavel className="h-4 w-4 text-primary" />
                <h2 className="text-[15px] font-semibold">Decision: {findingLabel(dispute.finding, kind)}</h2>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <dt className="text-muted-foreground">To the {roles.counterparty.toLowerCase()}</dt>
                  <dd className="text-[18px] font-semibold">{formatPrice(split.toOwner)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {kind === 'rental' ? 'Refunded to the renter' : 'Refunded to the buyer'}
                  </dt>
                  <dd className="text-[18px] font-semibold">{formatPrice(split.toClaimantSide)}</dd>
                </div>
              </dl>
              {dispute.resolutionNote && (
                <p className="mt-4 border-t border-border pt-3 text-[13px] text-foreground">
                  <span className="font-semibold">Admin note:</span> {dispute.resolutionNote}
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Refunds land in the in-app wallet. {kind === 'rental' ? 'The owner never receives more than the deposit.' : 'The buyer protection fee is not refunded.'}
              </p>
              <DemoNote className="mt-3" />
            </section>
          )}

          {/* Claim */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">The claim</h2>
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-foreground">{dispute.description || 'No description.'}</p>
            {dispute.claimAmount !== undefined && (
              <p className="mt-3 text-[13px]">
                <span className="text-muted-foreground">
                  {dispute.filedBy === ownerId ? 'Amount claimed: ' : 'Refund requested: '}
                </span>
                <span className="font-semibold">{formatPrice(dispute.claimAmount)}</span>
              </p>
            )}
            <EvidenceGallery className="mt-5" title="Evidence" paths={photos.evidence} empty="No evidence attached." />
          </section>

          {/* Condition photos */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-[15px] font-semibold">Condition photos</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <EvidenceGallery title="At handover" paths={photos.handover} empty="No handover photos." />
              {rental && <EvidenceGallery title="At return" paths={photos.returned} empty="No return photos." />}
            </div>
          </section>

          <CommentThread disputeId={dispute.id} open={open} />
        </div>

        <aside className="space-y-6">
          <DealSummary rental={rental} transaction={transaction} listing={listing} />
          <section className="rounded-xl border border-border bg-surface p-5 text-[12px] leading-relaxed text-muted-foreground">
            <p className="mb-2 text-[13px] font-semibold text-foreground">How {BRAND} decides</p>
            {kind === 'rental' ? (
              <ul className="list-disc space-y-1 pl-4">
                <li>Normal wear: nothing to the owner, the full deposit goes back to the renter.</li>
                <li>Repairable damage: the repair cost to the owner, the rest refunded.</li>
                <li>Lost or destroyed: the full deposit to the owner.</li>
                <li>Any late fee also comes out of the deposit. The owner never receives more than the deposit.</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-1 pl-4">
                <li>Not as described: a full or partial refund to the buyer.</li>
                <li>As described: the seller is paid in full.</li>
              </ul>
            )}
          </section>
          {open && <DemoNote />}
        </aside>
      </div>
    </div>
  )
}
