'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Search, AlertOctagon } from 'lucide-react'
import { settleDeposit, type DepositSettlement } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

// Admin outcomes from docs/BusinessRules.md §6. Everything is simulated:
// applying a decision only changes local state, no money moves.
type Outcome = 'normal-wear' | 'repairable' | 'lost' | 'not-as-described'

const OUTCOMES: Record<Outcome, { label: string; rule: string; kind: 'rental' | 'sale' }> = {
  'normal-wear':      { label: 'Normal wear',         rule: '฿0 to the owner, full deposit refunded',          kind: 'rental' },
  repairable:         { label: 'Repairable damage',   rule: 'Repair cost to the owner, the rest refunded',     kind: 'rental' },
  lost:               { label: 'Lost or destroyed',   rule: 'Full deposit to the owner',                       kind: 'rental' },
  'not-as-described': { label: 'Not as described',    rule: 'Full or partial refund to the buyer',             kind: 'sale' },
}

type Status = 'Action Required' | 'In Review' | 'Resolved'

interface Dispute {
  id: string
  tx: string
  kind: 'rental' | 'sale'
  /** Renter (rental) or buyer (sale). */
  claimant: string
  /** Owner (rental) or seller (sale). */
  counterparty: string
  reason: string
  /** Deposit (rental) or sale price (protected sale) held in escrow. */
  held: number
  status: Status
  date: string
  decision?: { outcome: Outcome; split: DepositSettlement }
}

const DISPUTES: Dispute[] = [
  { id: 'DSP-001', tx: 'TX-5821', kind: 'sale',   claimant: 'Alex W.', counterparty: 'Priya S.', reason: 'Item not as described', held: 450, status: 'Action Required', date: 'Oct 7, 2026' },
  { id: 'DSP-002', tx: 'TX-5492', kind: 'rental', claimant: 'Emma W.', counterparty: 'John D.',  reason: 'Mini fridge returned with a cracked shelf', held: 800, status: 'In Review', date: 'Oct 6, 2026' },
  {
    id: 'DSP-003', tx: 'TX-5103', kind: 'rental', claimant: 'Liam T.', counterparty: 'Sarah M.', reason: 'Bicycle returned with a bent wheel', held: 1000, status: 'Resolved', date: 'Oct 1, 2026',
    decision: { outcome: 'repairable', split: settleDeposit(1000, 350) },
  },
]

/**
 * What the owner/seller keeps for an outcome. `amount` is the repair cost
 * (repairable damage) or the refund to the buyer (not as described).
 * settleDeposit caps it so the owner never receives more than is held.
 */
function settle(outcome: Outcome, held: number, amount: number): DepositSettlement {
  switch (outcome) {
    case 'normal-wear':
      return settleDeposit(held, 0)
    case 'repairable':
      return settleDeposit(held, amount)
    case 'lost':
      return settleDeposit(held, held)
    case 'not-as-described':
      return settleDeposit(held, held - Math.min(held, Math.max(0, amount)))
  }
}

function partyLabels(kind: Dispute['kind']) {
  return kind === 'rental' ? { claimant: 'Renter', counterparty: 'Owner' } : { claimant: 'Buyer', counterparty: 'Seller' }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>(DISPUTES)
  const [openId, setOpenId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [amount, setAmount] = useState('')

  const startResolve = (d: Dispute) => {
    setOpenId(openId === d.id ? null : d.id)
    setOutcome(d.kind === 'sale' ? 'not-as-described' : null)
    setAmount(d.kind === 'sale' ? String(d.held) : '')
  }

  const apply = (d: Dispute) => {
    if (!outcome) return
    const split = settle(outcome, d.held, Number(amount) || 0)
    setDisputes((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: 'Resolved', decision: { outcome, split } } : x)))
    setOpenId(null)
    const { counterparty, claimant } = partyLabels(d.kind)
    toast.success(`${d.id} resolved`, {
      description: `${formatPrice(split.toOwner)} to the ${counterparty.toLowerCase()}, ${formatPrice(split.toRenter)} refunded to the ${claimant.toLowerCase()} (simulated).`,
    })
  }

  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Admin Portal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Disputes</h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Decide using the chat history and the before/after photos. The owner can never receive more than
            the deposit held.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search disputes..."
            className="h-10 w-full border border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-4 border-b border-border">ID</th>
                <th className="px-6 py-4 border-b border-border">Transaction</th>
                <th className="px-6 py-4 border-b border-border">Parties</th>
                <th className="px-6 py-4 border-b border-border">Reason</th>
                <th className="px-6 py-4 border-b border-border">Held</th>
                <th className="px-6 py-4 border-b border-border">Status</th>
                <th className="px-6 py-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disputes.map((d) => {
                const labels = partyLabels(d.kind)
                const isOpen = openId === d.id
                const options = (Object.keys(OUTCOMES) as Outcome[]).filter((o) => OUTCOMES[o].kind === d.kind)
                const preview = outcome && isOpen ? settle(outcome, d.held, Number(amount) || 0) : null
                const needsAmount = outcome === 'repairable' || outcome === 'not-as-described'
                return (
                  <Fragment key={d.id}>
                    <tr className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-6 py-4 font-semibold">{d.id}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-medium text-primary hover:underline cursor-pointer">{d.tx}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                          {d.kind === 'rental' ? 'Rental' : 'Protected sale'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{d.claimant} <span className="text-muted-foreground font-normal">({labels.claimant})</span></p>
                        <p className="font-medium text-foreground mt-1">{d.counterparty} <span className="text-muted-foreground font-normal">({labels.counterparty})</span></p>
                      </td>
                      <td className="px-6 py-4">
                        <p>{d.reason}</p>
                        {d.decision && (
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {OUTCOMES[d.decision.outcome].label}: {formatPrice(d.decision.split.toOwner)} to {labels.counterparty.toLowerCase()},{' '}
                            {formatPrice(d.decision.split.toRenter)} to {labels.claimant.toLowerCase()}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold">{formatPrice(d.held)}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                          d.status === 'Resolved' ? 'bg-primary-muted text-primary'
                            : d.status === 'Action Required' ? 'bg-destructive/10 text-destructive'
                            : 'bg-amber-100 text-amber-700',
                        )}>
                          {d.status === 'Action Required' && <AlertOctagon className="h-3 w-3" />}
                          {d.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {d.status !== 'Resolved' && (
                          <button
                            onClick={() => startResolve(d)}
                            className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
                          >
                            {isOpen ? 'Cancel' : 'Resolve'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-background">
                        <td colSpan={7} className="px-6 py-5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Finding</p>
                          <div className="flex flex-wrap gap-2">
                            {options.map((o) => (
                              <button
                                key={o}
                                onClick={() => setOutcome(o)}
                                className={cn(
                                  'border px-3 py-2 text-left text-[12px] transition-colors',
                                  outcome === o ? 'border-primary bg-primary-muted text-foreground' : 'border-border hover:border-primary/50',
                                )}
                              >
                                <span className="block font-semibold">{OUTCOMES[o].label}</span>
                                <span className="block text-muted-foreground">{OUTCOMES[o].rule}</span>
                              </button>
                            ))}
                          </div>

                          {needsAmount && (
                            <label className="mt-4 flex items-center gap-3 text-[12px]">
                              <span className="font-medium">
                                {outcome === 'repairable' ? 'Repair cost' : 'Refund to buyer'} (max {formatPrice(d.held)})
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={d.held}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-9 w-28 border border-input bg-surface px-2 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </label>
                          )}

                          {preview && (
                            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                              <p className="text-[12px] text-muted-foreground">
                                {labels.counterparty}: <span className="font-semibold text-foreground">{formatPrice(preview.toOwner)}</span>
                                {' · '}
                                {labels.claimant}: <span className="font-semibold text-foreground">{formatPrice(preview.toRenter)}</span>
                              </p>
                              <button
                                onClick={() => apply(d)}
                                className="rounded-sm bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                              >
                                Apply decision
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
