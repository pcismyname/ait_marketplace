'use client'

// Resolve a dispute with the BusinessRules §6 outcomes. The split preview uses
// settleDeposit from lib/fees.ts (the same maths as resolve_dispute); the
// server recomputes and records it.

import { useState } from 'react'
import { toast } from 'sonner'
import { Gavel } from 'lucide-react'
import { resolveDispute } from '@/lib/api'
import { SALE_COMMISSION_RATE } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Dispute, DisputeFinding, Rental, Transaction } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DemoNote } from '@/components/dispute/demo-note'
import { previewResolution } from '@/components/dispute/dispute-helpers'
import { cn } from '@/lib/utils'

interface Outcome {
  finding: DisputeFinding
  label: string
  rule: string
  /** What the amount input means, when the outcome takes one. */
  amountLabel?: string
}

const RENTAL_OUTCOMES: Outcome[] = [
  { finding: 'normal-wear', label: 'Normal wear', rule: '฿0 to the owner, full deposit refunded' },
  {
    finding: 'repairable-damage',
    label: 'Repairable damage',
    rule: 'Repair cost to the owner, the rest refunded',
    amountLabel: 'Repair cost',
  },
  { finding: 'lost-or-destroyed', label: 'Lost or destroyed', rule: 'Full deposit to the owner' },
]

const SALE_OUTCOMES: Outcome[] = [
  {
    finding: 'not-as-described',
    label: 'Not as described',
    rule: 'Full or partial refund to the buyer',
    amountLabel: 'Refund to the buyer',
  },
  // buyer_userflow figure: "Item not as described? — No → escrow releases payment to seller".
  { finding: 'normal-wear', label: 'As described', rule: 'Claim rejected, the seller is paid in full' },
]

export function ResolvePanel({
  dispute,
  rental,
  transaction,
  onResolved,
}: {
  dispute: Dispute
  rental?: Rental
  transaction?: Transaction
  onResolved: (dispute: Dispute) => void
}) {
  const kind = rental ? 'rental' : 'sale'
  const outcomes = kind === 'rental' ? RENTAL_OUTCOMES : SALE_OUTCOMES
  const held = rental ? rental.deposit : (transaction?.price ?? 0)
  const lateFee = rental?.lateFee ?? 0

  const [finding, setFinding] = useState<DisputeFinding | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outcome = outcomes.find((o) => o.finding === finding)
  const needsAmount = Boolean(outcome?.amountLabel)
  const amountValue = amount.trim() === '' ? NaN : Number(amount)
  const amountInvalid =
    needsAmount && (!Number.isInteger(amountValue) || amountValue < 0 || amountValue > held)

  const preview =
    finding && !amountInvalid
      ? previewResolution(
          rental ? { kind: 'rental', deposit: rental.deposit, lateFee } : { kind: 'sale', price: held },
          finding,
          needsAmount ? amountValue : 0,
        )
      : null

  const choose = (o: Outcome) => {
    setFinding(o.finding)
    setConfirming(false)
    setError(null)
    if (o.finding === 'not-as-described') setAmount(String(dispute.claimAmount ?? held))
    else if (o.finding === 'repairable-damage') setAmount(dispute.claimAmount !== undefined ? String(dispute.claimAmount) : '')
    else setAmount('')
  }

  const submit = async () => {
    if (!finding || amountInvalid) return
    setBusy(true)
    setError(null)
    try {
      const resolved = await resolveDispute(dispute.id, finding, needsAmount ? amountValue : undefined, note.trim() || undefined)
      const toOwner = rental ? resolved.depositToOwner : resolved.sellerAmount
      const toOther = rental ? resolved.depositToRenter : resolved.refundToBuyer
      toast.success('Dispute resolved', {
        description: `${formatPrice(toOwner ?? 0)} to the ${rental ? 'owner' : 'seller'}, ${formatPrice(toOther ?? 0)} to the ${rental ? 'renter' : 'buyer'} (simulated).`,
      })
      onResolved(resolved)
    } catch (e) {
      setError((e as Error).message)
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5" data-testid="resolve-panel">
      <div className="mb-1 flex items-center gap-2">
        <Gavel className="h-4 w-4 text-primary" />
        <h2 className="text-[15px] font-semibold">Resolve</h2>
      </div>
      <p className="mb-4 text-[12px] text-muted-foreground">
        {rental
          ? `Deposit held: ${formatPrice(held)}${lateFee > 0 ? ` (late fee ${formatPrice(lateFee)} goes to the owner on top of any claim)` : ''}. The owner never receives more than the deposit.`
          : `Price held: ${formatPrice(held)}. The buyer protection fee (${formatPrice(transaction?.protectionFee ?? 0)}) is not refunded.${
              (transaction?.sellerCommission ?? 0) > 0
                ? ` The seller pays a ${Math.round(SALE_COMMISSION_RATE * 100)}% commission on what they keep (none on a full refund).`
                : ''
            }`}
      </p>

      <div className="grid gap-2">
        {outcomes.map((o) => (
          <button
            key={o.finding}
            type="button"
            onClick={() => choose(o)}
            data-testid={`finding-${o.finding}`}
            className={cn(
              'rounded-md border px-3 py-2.5 text-left text-[12px] transition-colors',
              finding === o.finding ? 'border-primary bg-primary-muted' : 'border-border hover:border-primary/50',
            )}
          >
            <span className="block text-[13px] font-semibold text-foreground">{o.label}</span>
            <span className="block text-muted-foreground">{o.rule}</span>
          </button>
        ))}
      </div>

      {needsAmount && (
        <label className="mt-4 block text-[12px]">
          <span className="font-medium">
            {outcome?.amountLabel} (฿0 – {formatPrice(held)})
          </span>
          <input
            type="number"
            min={0}
            max={held}
            step={1}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setConfirming(false)
            }}
            data-testid="resolve-amount"
            className="mt-1 block h-9 w-36 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {amountInvalid && (
            <span className="mt-1 block text-destructive">Enter a whole amount from ฿0 to {formatPrice(held)}.</span>
          )}
          {dispute.claimAmount !== undefined && (
            <span className="mt-1 block text-muted-foreground">Claimed by the filer: {formatPrice(dispute.claimAmount)}</span>
          )}
        </label>
      )}

      {preview && (
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-background p-3 text-[12px]" data-testid="resolve-preview">
          <div>
            <dt className="text-muted-foreground">To the {rental ? 'owner' : 'seller'}</dt>
            <dd className="text-[16px] font-semibold">{formatPrice(preview.toOwner)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Refunded to the {rental ? 'renter' : 'buyer'}</dt>
            <dd className="text-[16px] font-semibold">{formatPrice(preview.toRenter)}</dd>
          </div>
        </dl>
      )}

      {finding && (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note to both parties (optional): what you saw in the photos and chat."
          className="mt-4 min-h-[72px] resize-none text-[13px]"
          maxLength={1000}
        />
      )}

      {error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {!confirming ? (
          <Button className="h-10 w-full" disabled={!preview || busy} onClick={() => setConfirming(true)}>
            Review decision
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-foreground">
              Settle {formatPrice(held)}: {formatPrice(preview?.toOwner ?? 0)} to the {rental ? 'owner' : 'seller'} and{' '}
              {formatPrice(preview?.toRenter ?? 0)} to the {rental ? 'renter' : 'buyer'}. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" disabled={busy} onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button className="h-10 flex-1" disabled={busy} onClick={submit} data-testid="confirm-resolve">
                {busy ? 'Resolving…' : 'Confirm and settle'}
              </Button>
            </div>
          </div>
        )}
        <DemoNote />
      </div>
    </section>
  )
}
