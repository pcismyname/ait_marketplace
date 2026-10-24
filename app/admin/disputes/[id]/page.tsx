'use client'

// Admin dispute detail: the claim, before/after photos, the parties' chat
// history and the dispute discussion, then the decision (ResolvePanel) and
// demo tools (time travel). Everything comes from getDisputeContext.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Gavel, Loader2, MessageCircle, ShieldAlert } from 'lucide-react'
import { getDisputeContext, type DisputeContext } from '@/lib/api'
import { subscribeToTable } from '@/lib/api/client'
import { useMarketplace } from '@/lib/store'
import { formatPrice } from '@/lib/format'
import { CommentThread } from '@/components/dispute/comment-thread'
import { DealSummary } from '@/components/dispute/deal-summary'
import { EvidenceGallery } from '@/components/dispute/evidence-gallery'
import { findingLabel, formatDateTime, resolvedSplit } from '@/components/dispute/dispute-helpers'
import { ResolvePanel } from '@/components/admin/resolve-panel'
import { DemoTools } from '@/components/admin/demo-tools'
import { cn } from '@/lib/utils'

export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getUser, refresh } = useMarketplace()
  const [ctx, setCtx] = useState<DisputeContext | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setCtx(await getDisputeContext(id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setCtx(null)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data; state is set after the await
    void load()
    return subscribeToTable('disputes', () => void load(), `id=eq.${id}`)
  }, [id, load])

  if (ctx === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!ctx) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Dispute not found</h1>
        {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
        <Link href="/admin/disputes" className="mt-4 inline-block text-[13px] font-semibold text-primary hover:underline">
          Back to the queue
        </Link>
      </div>
    )
  }

  const { dispute, rental, transaction, listing, messages, photos } = ctx
  const kind = rental ? 'rental' : 'sale'
  const open = dispute.status === 'open'
  const split = resolvedSplit(dispute)
  const dealId = rental?.id ?? transaction?.id
  const ownerId = rental?.ownerId ?? transaction?.sellerId

  return (
    <div>
      <Link href="/admin/disputes" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Dispute queue
      </Link>

      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-tag mb-2">{kind === 'rental' ? 'Rental dispute' : 'Protected sale dispute'}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dispute.reason}</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {listing?.title ?? 'Listing removed'} · {getUser(dispute.filedBy).name} (
            {dispute.filedBy === ownerId ? (kind === 'rental' ? 'owner' : 'seller') : kind === 'rental' ? 'renter' : 'buyer'}) vs{' '}
            {getUser(dispute.againstId).name} · filed {formatDateTime(dispute.createdAt)}
          </p>
        </div>
        <span
          data-testid="admin-dispute-status"
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
            open ? 'bg-destructive/10 text-destructive' : 'bg-primary-muted text-primary',
          )}
        >
          {open ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {open ? 'Needs decision' : 'Resolved'}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-2 text-[15px] font-semibold">The claim</h2>
            <p className="whitespace-pre-wrap text-[13px]">{dispute.description || 'No description.'}</p>
            {dispute.claimAmount !== undefined && (
              <p className="mt-3 text-[13px]">
                <span className="text-muted-foreground">{dispute.filedBy === ownerId ? 'Amount claimed: ' : 'Refund requested: '}</span>
                <span className="font-semibold">{formatPrice(dispute.claimAmount)}</span>
              </p>
            )}
            <EvidenceGallery className="mt-5" title="Evidence from the filer" paths={photos.evidence} empty="No evidence attached." />
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-[15px] font-semibold">Before / after</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <EvidenceGallery title="Before: at handover" paths={photos.handover} empty="No handover photos." />
              {rental ? (
                <EvidenceGallery title="After: at return" paths={photos.returned} empty="No return photos." />
              ) : (
                <p className="text-[12px] text-muted-foreground">Sales have handover photos only; compare with the listing photos.</p>
              )}
            </div>
            {listing && listing.images.length > 0 && (
              <div className="mt-5">
                <p className="label-tag mb-2">Listing photos</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {listing.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- public listing photos
                    <img key={src} src={src} alt={listing.title} className="aspect-square w-full rounded-md border border-border object-cover" />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface" data-testid="chat-history">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Chat history between the parties</h2>
            </div>
            <div className="max-h-[360px] space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">The parties have no chat about this listing.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-[13px]">
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{getUser(m.senderId).name}</span> · {formatDateTime(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <CommentThread disputeId={dispute.id} open={open} />
        </div>

        <aside className="space-y-6">
          <DealSummary rental={rental} transaction={transaction} listing={listing} showDealLink={false} />

          {open ? (
            <ResolvePanel
              dispute={dispute}
              rental={rental}
              transaction={transaction}
              onResolved={() => {
                void load()
                void refresh()
              }}
            />
          ) : (
            split &&
            dispute.finding && (
              <section className="rounded-xl border border-primary/30 bg-primary-muted/40 p-5" data-testid="admin-decision">
                <div className="mb-3 flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" />
                  <h2 className="text-[15px] font-semibold">{findingLabel(dispute.finding, kind)}</h2>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="text-muted-foreground">To the {kind === 'rental' ? 'owner' : 'seller'}</dt>
                    <dd className="text-[16px] font-semibold">{formatPrice(split.toOwner)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">To the {kind === 'rental' ? 'renter' : 'buyer'}</dt>
                    <dd className="text-[16px] font-semibold">{formatPrice(split.toClaimantSide)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Resolved {formatDateTime(dispute.resolvedAt)}
                  {dispute.resolvedBy ? ` by ${getUser(dispute.resolvedBy).name}` : ''}.
                </p>
                {dispute.resolutionNote && <p className="mt-2 text-[13px]">{dispute.resolutionNote}</p>}
              </section>
            )
          )}

          {dispute.status === 'open' && <DemoTools dealId={dealId} onDone={() => void load()} />}
        </aside>
      </div>
    </div>
  )
}
