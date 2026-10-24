'use client'

// File a dispute (BusinessRules §6): a rental after the return (either party)
// or a protected purchase after handover (buyer only), within 48 hours.
//   /dispute/new?rental=<rentalId>   ·   /dispute/new?transaction=<transactionId>
// Evidence goes to the private dispute-evidence bucket first (uploadEvidence),
// then file_dispute freezes the escrow. The server re-checks every rule.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertOctagon, ArrowLeft, Clock, Loader2, UploadCloud, X } from 'lucide-react'
import {
  fileDispute,
  getDisputeFor,
  getListing,
  getRental,
  getTransaction,
  uploadEvidence,
  validateFile,
  type Deal,
} from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import { DISPUTE_WINDOW_HOURS, settleDeposit } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Dispute, Listing } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DealSummary } from '@/components/dispute/deal-summary'
import { DemoNote } from '@/components/dispute/demo-note'
import {
  filingBlocker,
  formatDateTime,
  formatDuration,
  reasonOptions,
  windowLeftMs,
} from '@/components/dispute/dispute-helpers'

const MAX_FILES = 8

export default function NewDisputePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewDispute />
    </Suspense>
  )
}

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

interface Picked {
  file: File
  preview: string
}

function NewDispute() {
  const params = useSearchParams()
  const router = useRouter()
  const { currentUserId, loading: storeLoading } = useMarketplace()
  const rentalId = params.get('rental')
  const transactionId = params.get('transaction')

  const [deal, setDeal] = useState<Deal | null>(null)
  const [listing, setListing] = useState<Listing | undefined>()
  const [existing, setExisting] = useState<Dispute | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [claim, setClaim] = useState('')
  const [files, setFiles] = useState<Picked[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (storeLoading || !currentUserId) return
    let cancelled = false
    ;(async () => {
      try {
        let next: Deal | null = null
        if (rentalId) {
          const rental = await getRental(rentalId)
          if (rental) next = { kind: 'rental', rental }
        } else if (transactionId) {
          const transaction = await getTransaction(transactionId)
          if (transaction) next = { kind: 'sale', transaction }
        }
        if (cancelled) return
        if (!next) {
          setLoadError(rentalId || transactionId ? 'We could not find that rental or purchase.' : 'Open this page from a rental or a purchase.')
          return
        }
        const listingId = next.kind === 'rental' ? next.rental.listingId : next.transaction.listingId
        const [l, d] = await Promise.all([
          getListing(listingId),
          getDisputeFor(next.kind === 'rental' ? { rentalId: next.rental.id } : { transactionId: next.transaction.id }),
        ])
        if (cancelled) return
        setDeal(next)
        setListing(l ?? undefined)
        setExisting(d && d.status === 'open' ? d : null)
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rentalId, transactionId, currentUserId, storeLoading])

  // Revoke the preview object URLs when leaving the page.
  const filesRef = useRef<Picked[]>([])
  useEffect(() => {
    filesRef.current = files
  }, [files])
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), [])

  const role = useMemo<'owner' | 'renter' | 'buyer' | null>(() => {
    if (!deal || !currentUserId) return null
    if (deal.kind === 'rental') {
      if (deal.rental.ownerId === currentUserId) return 'owner'
      if (deal.rental.renterId === currentUserId) return 'renter'
      return null
    }
    return deal.transaction.buyerId === currentUserId ? 'buyer' : null
  }, [deal, currentUserId])

  if (storeLoading || (!loaded && !loadError)) return <PageLoading />

  const backHref = deal ? `/transaction/${deal.kind === 'rental' ? deal.rental.id : deal.transaction.id}` : '/rentals'

  if (loadError || !deal) {
    return (
      <Shell onBack={() => router.back()}>
        <Notice title="Can't open a dispute here">{loadError ?? 'Not found.'}</Notice>
      </Shell>
    )
  }

  if (existing) {
    return (
      <Shell onBack={() => router.back()}>
        <Notice title="A dispute is already open">
          The money stays held while an admin reviews it.{' '}
          <Link href={`/dispute/${existing.id}`} className="font-semibold text-primary hover:underline">
            Go to the dispute
          </Link>
        </Notice>
      </Shell>
    )
  }

  const blocker = currentUserId ? filingBlocker(deal, currentUserId, now) : 'Log in to continue.'
  const windowEnds = deal.kind === 'rental' ? deal.rental.disputeWindowEndsAt : deal.transaction.disputeWindowEndsAt
  const left = windowLeftMs(windowEnds, now)

  // Claim limits and preview come from the deal row and lib/fees.ts.
  const isRental = deal.kind === 'rental'
  const held = isRental ? deal.rental.deposit : deal.transaction.price
  const lateFee = isRental ? deal.rental.lateFee : 0
  const showClaim = role === 'owner' || role === 'buyer'
  const claimValue = claim.trim() === '' ? null : Number(claim)
  const claimInvalid =
    claimValue !== null && (!Number.isFinite(claimValue) || claimValue < 0 || claimValue > held || !Number.isInteger(claimValue))
  const preview =
    showClaim && claimValue !== null && !claimInvalid
      ? role === 'owner'
        ? settleDeposit(held, lateFee + claimValue)
        : settleDeposit(held, held - claimValue)
      : null

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next: Picked[] = []
    for (const file of Array.from(list)) {
      const problem = validateFile(file, 'evidence')
      if (problem) {
        toast.error(`${file.name}: ${problem}`)
        continue
      }
      next.push({ file, preview: URL.createObjectURL(file) })
    }
    setFiles((prev) => {
      const merged = [...prev, ...next]
      if (merged.length > MAX_FILES) toast.error(`Up to ${MAX_FILES} files.`)
      return merged.slice(0, MAX_FILES)
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const gone = prev[index]
      if (gone) URL.revokeObjectURL(gone.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const canSubmit =
    !blocker && !submitting && reason.length > 0 && description.trim().length >= 10 && files.length > 0 && !claimInvalid

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    const target = isRental
      ? { kind: 'rental' as const, id: deal.rental.id }
      : { kind: 'sale' as const, id: deal.transaction.id }
    try {
      const paths: string[] = []
      for (const [i, picked] of files.entries()) {
        setProgress(`Uploading evidence ${i + 1} of ${files.length}…`)
        paths.push(await uploadEvidence(target, picked.file))
      }
      setProgress('Filing the dispute…')
      const dispute = await fileDispute({
        rentalId: isRental ? deal.rental.id : undefined,
        transactionId: isRental ? undefined : deal.transaction.id,
        reason,
        description: description.trim(),
        evidence: paths,
        claimAmount: showClaim && claimValue !== null ? claimValue : undefined,
      })
      toast.success('Dispute filed', { description: 'The money stays held in escrow while an admin reviews it.' })
      router.replace(`/dispute/${dispute.id}`)
    } catch (error) {
      setSubmitError((error as Error).message)
      setSubmitting(false)
      setProgress('')
    }
  }

  return (
    <Shell onBack={() => router.push(backHref)}>
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Open a dispute</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {isRental
            ? 'Something wrong with the return? The deposit stays held in escrow until an admin compares the handover and return photos and the chat.'
            : 'Item not as described? The payment stays held in escrow until an admin reviews your evidence and the chat.'}
        </p>
      </div>

      <div className="space-y-6">
        <DealSummary rental={isRental ? deal.rental : undefined} transaction={isRental ? undefined : deal.transaction} listing={listing} />

        {blocker ? (
          <Notice title="You can't open a dispute on this deal">{blocker}</Notice>
        ) : (
          <>
            <div
              className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              data-testid="window-countdown"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <p>
                The {DISPUTE_WINDOW_HOURS}-hour window closes in <strong>{formatDuration(left)}</strong> ({formatDateTime(windowEnds)}).
                After that the money is released automatically.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-border bg-surface p-5 md:p-6">
              <div className="space-y-1.5">
                <label className="label-tag" htmlFor="dispute-reason">Reason</label>
                <Select value={reason} onValueChange={(v) => setReason(v ?? '')}>
                  <SelectTrigger id="dispute-reason" className="h-11 w-full" data-testid="reason-trigger">
                    <SelectValue placeholder="Choose what went wrong" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions(deal.kind, role ?? 'renter').map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="label-tag" htmlFor="dispute-description">What happened</label>
                <Textarea
                  id="dispute-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem: what you expected, what you found, and anything you already agreed in chat."
                  maxLength={4000}
                  className="min-h-[120px] resize-none text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground">At least 10 characters.</p>
              </div>

              {showClaim && (
                <div className="space-y-1.5">
                  <label className="label-tag" htmlFor="dispute-claim">
                    {role === 'owner' ? 'Repair or replacement cost you claim' : 'Refund you are asking for'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">฿</span>
                    <input
                      id="dispute-claim"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={held}
                      step={1}
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      placeholder={role === 'buyer' ? String(held) : '0'}
                      className="h-10 w-36 rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[12px] text-muted-foreground">max {formatPrice(held)}</span>
                  </div>
                  {claimInvalid && (
                    <p className="text-[12px] text-destructive">Enter a whole amount from ฿0 to {formatPrice(held)}.</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {role === 'owner'
                      ? `Optional. You can never receive more than the ${formatPrice(held)} deposit${lateFee > 0 ? `, and the ${formatPrice(lateFee)} late fee already comes out of it` : ''}. The admin decides the final amount.`
                      : 'Optional; leave empty to ask for a full refund. The buyer protection fee is not refunded. The admin decides the final amount.'}
                  </p>
                  {preview && (
                    <p className="text-[12px] text-foreground" data-testid="claim-preview">
                      If the admin agrees:{' '}
                      {role === 'owner'
                        ? `${formatPrice(preview.toOwner)} to you, ${formatPrice(preview.toRenter)} back to the renter.`
                        : `${formatPrice(preview.toRenter)} refunded to you, ${formatPrice(preview.toOwner)} to the seller.`}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="label-tag">Evidence</p>
                <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background transition-colors hover:bg-muted/50">
                  <UploadCloud className="h-7 w-7 text-muted-foreground" />
                  <span className="mt-2 text-[12px] font-medium text-foreground">Add photos or a PDF</span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">JPG, PNG, WebP, HEIC or PDF · up to 10 MB each · {MAX_FILES} files</span>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                    onChange={(e) => {
                      addFiles(e.target.files)
                      e.target.value = ''
                    }}
                    data-testid="evidence-input"
                  />
                </label>
                {files.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {files.map((f, i) => (
                      <div key={f.preview} className="relative aspect-square overflow-hidden rounded-md border border-border bg-background">
                        {f.file.type === 'application/pdf' ? (
                          <span className="flex h-full items-center justify-center text-[11px] text-muted-foreground">PDF</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                          <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground"
                          aria-label={`Remove ${f.file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  At least one file. Only the other party and the admin can see it.
                </p>
              </div>

              {submitError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive" role="alert" data-testid="submit-error">
                  {submitError}
                </p>
              )}

              <div className="space-y-3 border-t border-border pt-5">
                <DemoNote />
                <Button type="submit" variant="destructive" disabled={!canSubmit} className="h-11 w-full text-[13px] font-semibold">
                  {submitting ? progress || 'Submitting…' : 'Freeze escrow and file dispute'}
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Filing notifies the other party and the admin team. False claims may lead to account suspension.
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      {children}
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5" role="status" data-testid="dispute-notice">
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{children}</p>
    </div>
  )
}
