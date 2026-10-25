'use client'

// Admin dispute queue (BusinessRules §6): open disputes first, oldest first,
// then resolved ones, newest first. Each row opens /admin/disputes/[id].

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertOctagon, CheckCircle2, Loader2, Search } from 'lucide-react'
import { getRental, getTransaction, listDisputes } from '@/lib/api'
import { subscribeToTable } from '@/lib/api/client'
import { useMarketplace } from '@/lib/store'
import { formatPrice, relativeTime } from '@/lib/format'
import type { Dispute, Rental, Transaction } from '@/lib/types'
import { findingLabel, formatDateTime, resolvedSplit } from '@/components/dispute/dispute-helpers'
import { cn } from '@/lib/utils'

type Filter = 'open' | 'resolved' | 'all'

interface Row {
  dispute: Dispute
  rental?: Rental
  transaction?: Transaction
}

export default function AdminDisputesPage() {
  const { listings, getUser } = useMarketplace()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const disputes = await listDisputes('all')
      const withDeals = await Promise.all(
        disputes.map(async (dispute): Promise<Row> => ({
          dispute,
          rental: dispute.rentalId ? ((await getRental(dispute.rentalId)) ?? undefined) : undefined,
          transaction: dispute.transactionId ? ((await getTransaction(dispute.transactionId)) ?? undefined) : undefined,
        })),
      )
      const open = withDeals
        .filter((r) => r.dispute.status === 'open')
        .sort((a, b) => a.dispute.createdAt.localeCompare(b.dispute.createdAt))
      const resolved = withDeals
        .filter((r) => r.dispute.status === 'resolved')
        .sort((a, b) => (b.dispute.resolvedAt ?? '').localeCompare(a.dispute.resolvedAt ?? ''))
      setRows([...open, ...resolved])
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data; state is set after the awaits
    void load()
    return subscribeToTable('disputes', () => void load())
  }, [load])

  const listingTitle = useCallback(
    (row: Row) => {
      const id = row.rental?.listingId ?? row.transaction?.listingId
      return listings.find((l) => l.id === id)?.title ?? 'Listing removed'
    },
    [listings],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      if (filter !== 'all' && row.dispute.status !== filter) return false
      if (!q) return true
      const haystack = [
        row.dispute.reason,
        row.dispute.description,
        listingTitle(row),
        getUser(row.dispute.filedBy).name,
        getUser(row.dispute.againstId).name,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, filter, query, listingTitle, getUser])

  const counts = useMemo(
    () => ({
      open: (rows ?? []).filter((r) => r.dispute.status === 'open').length,
      resolved: (rows ?? []).filter((r) => r.dispute.status === 'resolved').length,
      all: rows?.length ?? 0,
    }),
    [rows],
  )

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="label-tag mb-2">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Disputes</h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
            Decide using the chat history and the before/after photos. The money stays held until you resolve it, and the
            owner never receives more than the deposit.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item, party, reason…"
            aria-label="Search disputes"
            className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1" role="tablist">
        {(['open', 'resolved', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors',
              filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {f} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">Could not load disputes: {error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows === null ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            {filter === 'open' ? 'No open disputes. Nice.' : 'Nothing here.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]" data-testid="dispute-queue">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-5 py-3">Item</th>
                  <th className="border-b border-border px-5 py-3">Parties</th>
                  <th className="border-b border-border px-5 py-3">Reason</th>
                  <th className="border-b border-border px-5 py-3">Held</th>
                  <th className="border-b border-border px-5 py-3">Status</th>
                  <th className="border-b border-border px-5 py-3 text-right">Filed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((row) => {
                  const { dispute, rental, transaction } = row
                  const kind = rental ? 'rental' : 'sale'
                  const held = rental ? rental.deposit : (transaction?.price ?? 0)
                  const split = resolvedSplit(dispute)
                  return (
                    <tr key={dispute.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <Link href={`/admin/disputes/${dispute.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                          {listingTitle(row)}
                        </Link>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          {kind === 'rental' ? 'Rental' : 'Protected sale'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p>
                          {getUser(dispute.filedBy).name} <span className="text-muted-foreground">(filed)</span>
                        </p>
                        <p className="mt-0.5 text-muted-foreground">vs {getUser(dispute.againstId).name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{dispute.reason}</p>
                        {dispute.finding && split && (
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {findingLabel(dispute.finding, kind)}: {formatPrice(split.toOwner)} to {kind === 'rental' ? 'owner' : 'seller'},{' '}
                            {formatPrice(split.toClaimantSide)} to {kind === 'rental' ? 'renter' : 'buyer'}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold">{formatPrice(held)}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                            dispute.status === 'open' ? 'bg-destructive/10 text-destructive' : 'bg-primary-muted text-primary',
                          )}
                        >
                          {dispute.status === 'open' ? <AlertOctagon className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {dispute.status === 'open' ? 'Needs decision' : 'Resolved'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-muted-foreground" title={formatDateTime(dispute.createdAt)}>
                        {relativeTime(dispute.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
