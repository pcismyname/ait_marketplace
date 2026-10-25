'use client'

// Admin overview: counters from admin_stats() (tables + the simulated wallet
// ledger), the open dispute queue, and demo tools for deals in progress.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Coins, Loader2, Lock, Tags, Users } from 'lucide-react'
import { listDisputes } from '@/lib/api'
import { getAdminStats, type AdminStats } from '@/lib/api/moderation'
import { useMarketplace } from '@/lib/store'
import { formatPrice, relativeTime } from '@/lib/format'
import type { Dispute } from '@/lib/types'
import { DemoNote } from '@/components/dispute/demo-note'
import { DemoTools } from '@/components/admin/demo-tools'
import { cn } from '@/lib/utils'

const IN_PROGRESS_RENTAL = ['paid', 'active', 'return-pending', 'disputed', 'overdue']
const IN_PROGRESS_SALE = ['paid', 'handed-over', 'disputed']

export default function AdminDashboardPage() {
  const { rentals, transactions, listings, getUser, refresh } = useMarketplace()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [open, setOpen] = useState<Dispute[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dealId, setDealId] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([getAdminStats(), listDisputes('open')])
      setStats(s)
      setOpen(d)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data; state is set after the await
    void load()
  }, [load])

  const title = useCallback((listingId: string) => listings.find((l) => l.id === listingId)?.title ?? 'Listing', [listings])

  const deals = useMemo(
    () => [
      ...rentals
        .filter((r) => IN_PROGRESS_RENTAL.includes(r.phase))
        .map((r) => ({ id: r.id, label: `Rental · ${title(r.listingId)} · ${r.phase}` })),
      ...transactions
        .filter((t) => t.mode === 'protected' && IN_PROGRESS_SALE.includes(t.status))
        .map((t) => ({ id: t.id, label: `Sale · ${title(t.listingId)} · ${t.status}` })),
    ],
    [rentals, transactions, title],
  )

  const tiles = stats
    ? [
        { label: 'Users', value: stats.users.toLocaleString('en-US'), sub: `${stats.admins} admin${stats.admins === 1 ? '' : 's'}`, icon: Users },
        {
          label: 'Active listings',
          value: stats.activeListings.toLocaleString('en-US'),
          sub: `${stats.listings} total · ${stats.hiddenListings} hidden`,
          icon: Tags,
        },
        {
          label: 'Open disputes',
          value: stats.openDisputes.toLocaleString('en-US'),
          sub: `${stats.resolvedDisputes} resolved`,
          icon: AlertTriangle,
          alert: stats.openDisputes > 0,
        },
        {
          label: 'Held in escrow',
          value: formatPrice(stats.heldEscrow),
          sub: `${stats.rentalsInProgress} rentals · ${stats.salesInEscrow} sales in progress`,
          icon: Lock,
        },
        { label: 'Platform revenue', value: formatPrice(stats.platformRevenue), sub: 'Commission, escrow and protection fees', icon: Coins },
      ]
    : []

  return (
    <div>
      <div className="mb-8">
        <p className="label-tag mb-2">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Live counts from the database and the simulated wallet ledger.</p>
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">Could not load the stats: {error}</p>}

      <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="admin-stats">
        {stats === null
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex h-[118px] items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ))
          : tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-border bg-surface p-5" data-testid={`stat-${tile.label}`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-muted-foreground">{tile.label}</p>
                  <tile.icon className={cn('h-4 w-4', tile.alert ? 'text-destructive' : 'text-primary')} />
                </div>
                <p className="text-[26px] font-semibold tracking-tight" data-testid="stat-value">{tile.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{tile.sub}</p>
              </div>
            ))}
      </div>
      <DemoNote className="mb-8" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold">Open disputes</h2>
            <Link href="/admin/disputes" className="text-[12px] font-semibold text-primary hover:underline">
              View queue
            </Link>
          </div>
          <div className="divide-y divide-border">
            {open.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No open disputes.</p>
            ) : (
              open.slice(0, 5).map((d) => (
                <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block px-5 py-4 transition-colors hover:bg-muted/50">
                  <div className="mb-1 flex justify-between gap-3">
                    <p className="text-[13px] font-semibold">{d.reason}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(d.createdAt)}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {d.rentalId ? 'Rental' : 'Protected sale'} · {getUser(d.filedBy).name} vs {getUser(d.againstId).name}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <div className="space-y-3">
          <label className="block text-[12px]">
            <span className="label-tag">Deal in progress</span>
            <select
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-input bg-surface px-2 text-[13px] outline-none focus:border-primary"
              data-testid="demo-deal-select"
            >
              <option value="">Choose a rental or protected sale…</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <DemoTools
            dealId={dealId || undefined}
            onDone={() => {
              void load()
              void refresh()
            }}
          />
        </div>
      </div>
    </div>
  )
}
