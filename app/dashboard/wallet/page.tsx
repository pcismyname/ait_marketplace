'use client'

// Simulated wallet (BusinessRules §7, §8; docs/Database.md §5). Balances come
// from get_wallet_summary, history from the user's wallet_ledger rows, and
// withdrawals from wallet_withdraw. No real money moves.
//
// The ledger books a protected purchase's price as held *for the seller*, so
// the buyer's held total leaves it out. The held card therefore also lists the
// buyer's own protected purchases still in escrow (from the store's deals).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, Landmark, Lock, Wallet } from 'lucide-react'
import { getWalletSummary, listLedger, withdraw } from '@/lib/api'
import type { LedgerBucket, LedgerEntry, LedgerKind, WalletSummary } from '@/lib/types'
import { BRAND } from '@/lib/data'
import { DISPUTE_WINDOW_HOURS, OWNER_PAYOUT_DELAY_HOURS } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { formatDateTime } from '@/lib/deal-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'
import { ESCROW_RAN_EVENT } from '@/components/escrow-job-runner'
import { useMarketplace } from '@/lib/store'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<LedgerKind, string> = {
  payment: 'Payment',
  hold: 'Held in escrow',
  hold_release: 'Released from escrow',
  payout: 'Payout',
  refund: 'Refund',
  claim: 'Deposit claim',
  platform_fee: 'Platform fee',
  withdrawal: 'Withdrawal',
}

const BUCKET_LABEL: Record<LedgerBucket, string> = {
  available: 'Wallet',
  held: 'Escrow',
  external: 'PromptPay / card',
  platform: 'Platform',
}

type Filter = 'all' | 'available' | 'held' | 'external'

const PAGE_SIZE = 25

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Wallet' },
  { id: 'held', label: 'Escrow' },
  { id: 'external', label: 'Payments in' },
]

export default function WalletPage() {
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { transactions, currentUserId } = useMarketplace()
  const purchasesInEscrow = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.buyerId === currentUserId &&
          t.mode === 'protected' &&
          (t.status === 'paid' || t.status === 'handed-over' || t.status === 'disputed'),
      ),
    [transactions, currentUserId],
  )
  const purchasesHeld = purchasesInEscrow.reduce((sum, t) => sum + t.price, 0)

  const load = useCallback(async () => {
    try {
      const [s, rows] = await Promise.all([getWalletSummary(), listLedger(200)])
      setSummary(s)
      setLedger(rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([getWalletSummary(), listLedger(200)]).then(
      ([s, rows]) => {
        if (cancelled) return
        setSummary(s)
        setLedger(rows)
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      },
    )
    const onJobs = () => void load()
    window.addEventListener(ESCROW_RAN_EVENT, onJobs)
    return () => {
      cancelled = true
      window.removeEventListener(ESCROW_RAN_EVENT, onJobs)
    }
  }, [load])

  const shown = useMemo(
    () => (filter === 'all' ? ledger : ledger.filter((row) => row.bucket === filter)),
    [ledger, filter],
  )

  return (
    <div className="space-y-10">
      <div>
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wallet &amp; escrow</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          What {BRAND} holds for you, what you can spend or withdraw, and every movement.
        </p>
      </div>

      {error && (
        <p className="border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          Could not load your wallet: {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="border border-border bg-card p-6" data-testid="wallet-available">
          <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <Wallet className="h-4 w-4" /> Available
          </p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums" data-testid="available-amount">
            {summary ? formatPrice(summary.available) : '—'}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Payouts and refunds land here. Spend it at checkout with &ldquo;Wallet&rdquo;, or withdraw it.
          </p>
        </div>

        <div className="border border-border bg-surface p-6" data-testid="wallet-held">
          <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <Lock className="h-4 w-4" /> Held in escrow
          </p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums" data-testid="held-amount">
            {summary ? formatPrice(summary.held) : '—'}
          </p>
          {summary && (
            <dl className="mt-3 space-y-1 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Your deposits</dt>
                <dd className="tabular-nums">{formatPrice(summary.depositsHeld)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payouts on the way to you</dt>
                <dd className="tabular-nums">{formatPrice(summary.pendingPayouts)}</dd>
              </div>
            </dl>
          )}
          {purchasesInEscrow.length > 0 && (
            <div className="mt-3 border-t border-border pt-3 text-[12px]" data-testid="purchases-in-escrow">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Your protected purchases in escrow ({purchasesInEscrow.length})
                </span>
                <span className="tabular-nums" data-testid="purchases-in-escrow-amount">
                  {formatPrice(purchasesHeld)}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Held for the sellers, not counted above. Refunded to you only if a dispute rules in your favour.{' '}
                {purchasesInEscrow.length === 1 ? (
                  <Link href={`/transaction/${purchasesInEscrow[0].id}`} className="font-semibold text-primary hover:underline">
                    View the deal
                  </Link>
                ) : (
                  <Link href="/dashboard/orders" className="font-semibold text-primary hover:underline">
                    View in orders
                  </Link>
                )}
              </p>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Deposits are held by {BRAND}, never the owner, and settled after the return ({DISPUTE_WINDOW_HOURS} h window).
            Rental fees are paid {OWNER_PAYOUT_DELAY_HOURS} h after handover; protected sales {DISPUTE_WINDOW_HOURS} h after handover.
          </p>
        </div>

        <WithdrawCard available={summary?.available ?? 0} onDone={load} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Activity</h2>
          <div className="flex gap-1" role="tablist" aria-label="Filter activity">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => {
                  setFilter(f.id)
                  setLimit(PAGE_SIZE)
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  filter === f.id ? 'bg-primary-muted text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="border border-border bg-card" data-testid="ledger">
          {shown.length === 0 ? (
            <p className="p-6 text-[13px] text-muted-foreground">
              {summary ? 'No activity yet.' : 'Loading…'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.slice(0, limit).map((row) => (
                <LedgerRow key={row.id} row={row} />
              ))}
            </ul>
          )}
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="w-full border-t border-border p-3 text-[12px] font-semibold text-primary hover:bg-muted/50"
            >
              Show more ({shown.length - limit} older)
            </button>
          )}
        </div>
        <SimulatedPaymentsNote />
      </section>
    </div>
  )
}

function LedgerRow({ row }: { row: LedgerEntry }) {
  const credit = row.amount > 0
  const dealId = row.rentalId ?? row.transactionId
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            credit ? 'bg-primary-muted text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{row.memo || KIND_LABEL[row.kind]}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatDateTime(row.createdAt)} · {KIND_LABEL[row.kind]}
            {row.paymentMethod ? ` · ${row.paymentMethod === 'promptpay' ? 'PromptPay' : row.paymentMethod}` : ''}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-[14px] font-semibold tabular-nums', credit && 'text-primary')}>
          {credit ? '+' : '−'}
          {formatPrice(Math.abs(row.amount))}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {BUCKET_LABEL[row.bucket]}
        </p>
      </div>
    </>
  )
  return (
    <li>
      {dealId ? (
        <Link
          href={`/transaction/${dealId}`}
          className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50 sm:px-6"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-4 p-4 sm:px-6">{content}</div>
      )}
    </li>
  )
}

function WithdrawCard({ available, onDone }: { available: number; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const value = Number(amount)
  const valid = amount !== '' && Number.isFinite(value) && value > 0 && value <= available

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      await withdraw(value)
      toast.success('Withdrawal sent (simulated)', { description: `${formatPrice(value)} to your bank account.` })
      setAmount('')
      await onDone()
    } catch (error) {
      toast.error('Could not withdraw', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col border border-border bg-card p-6" data-testid="withdraw">
      <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Landmark className="h-4 w-4" /> Withdraw to your bank
      </p>
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">฿</span>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            max={available}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            aria-label="Amount to withdraw"
            className="h-9 pl-6"
            disabled={busy || available <= 0}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={busy || available <= 0}
          onClick={() => setAmount(String(available))}
        >
          All
        </Button>
      </div>
      {amount !== '' && !valid && (
        <p className="mt-2 text-[11px] text-destructive">Enter an amount up to {formatPrice(available)}.</p>
      )}
      <Button type="submit" className="mt-4 h-9 w-full" disabled={!valid || busy}>
        {busy ? 'Sending…' : 'Withdraw'}
      </Button>
      <SimulatedPaymentsNote className="mt-3" />
    </form>
  )
}
