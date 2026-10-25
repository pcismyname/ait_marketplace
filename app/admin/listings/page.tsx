'use client'

// Listing moderation: hide (pause and lock), restore, or remove a listing
// (admin_moderate_listing). Listings with a deal in progress can't be hidden,
// and listings with rental or sale history can't be removed (hide them).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { EyeOff, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react'
import {
  listAllListingsForModeration,
  moderateListing,
  type ModeratedListing,
  type ModerationAction,
} from '@/lib/api/moderation'
import { useMarketplace } from '@/lib/store'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'hidden' | 'available' | 'other'

export default function AdminListingsPage() {
  const { getUser, refresh } = useMarketplace()
  const [items, setItems] = useState<ModeratedListing[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [pending, setPending] = useState<{ id: string; action: ModerationAction } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await listAllListingsForModeration())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data; state is set after the await
    void load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((l) => {
      if (filter === 'hidden' && !l.hiddenAt) return false
      if (filter === 'available' && (l.status !== 'available' || l.hiddenAt)) return false
      if (filter === 'other' && (l.status === 'available' || l.hiddenAt)) return false
      if (!q) return true
      return `${l.title} ${l.description} ${getUser(l.sellerId).name}`.toLowerCase().includes(q)
    })
  }, [items, query, filter, getUser])

  const start = (id: string, action: ModerationAction) => {
    setPending({ id, action })
    setReason('')
  }

  const apply = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const result = await moderateListing(pending.id, pending.action, reason.trim() || undefined)
      toast.success(`Listing ${result}`, {
        description: result === 'restored' ? 'It stays paused until the seller relists it.' : 'The seller was notified.',
      })
      setPending(null)
      await load()
      void refresh()
    } catch (e) {
      toast.error('Could not change the listing', { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="label-tag mb-2">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listing moderation</h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
            Hide a listing to take it off the marketplace (the seller can&apos;t relist it until you restore it), or remove
            one that never had a deal.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or seller…"
            aria-label="Search listings"
            className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Listing status">
        {(
          [
            ['all', 'All'],
            ['available', 'Available'],
            ['hidden', 'Hidden'],
            ['other', 'Reserved, rented, sold, paused'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
              filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">Could not load listings: {error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {items === null ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]" data-testid="listing-table">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-5 py-3">Listing</th>
                  <th className="border-b border-border px-5 py-3">Seller</th>
                  <th className="border-b border-border px-5 py-3">Price</th>
                  <th className="border-b border-border px-5 py-3">Status</th>
                  <th className="border-b border-border px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      No listings match.
                    </td>
                  </tr>
                )}
                {visible.map((l) => {
                  const isPending = pending?.id === l.id
                  return (
                    <tr key={l.id} className="align-top transition-colors hover:bg-muted/30" data-testid="listing-row">
                      <td className="px-5 py-4">
                        <Link href={`/listing/${l.id}`} className="font-semibold hover:text-primary hover:underline">
                          {l.title}
                        </Link>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          {l.type === 'rent' ? 'For rent' : 'For sale'} · {l.category}
                        </p>
                        {isPending && (
                          <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
                            <p className="text-[12px] font-semibold">
                              {pending.action === 'hide' ? 'Hide this listing?' : pending.action === 'remove' ? 'Remove this listing for good?' : 'Restore this listing?'}
                            </p>
                            {pending.action !== 'restore' && (
                              <input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Reason, shown to the seller (optional)"
                                aria-label="Reason, shown to the seller"
                                className="h-9 w-full rounded-md border border-input bg-surface px-2 text-[12px] outline-none focus:border-primary"
                                data-testid="moderation-reason"
                              />
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending(null)}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant={pending.action === 'restore' ? 'default' : 'destructive'}
                                disabled={busy}
                                onClick={apply}
                                data-testid="moderation-confirm"
                              >
                                {busy ? 'Saving…' : `Confirm ${pending.action}`}
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">{getUser(l.sellerId).name}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {formatPrice(l.price)}
                        {l.type === 'rent' && l.deposit !== undefined && (
                          <span className="block text-[11px] text-muted-foreground">+{formatPrice(l.deposit)} deposit</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {l.hiddenAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive" title={l.hiddenReason}>
                            <EyeOff className="h-3 w-3" /> Hidden
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
                              l.status === 'available' ? 'bg-primary-muted text-primary' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {l.status}
                          </span>
                        )}
                        {l.hiddenReason && <span className="mt-1 block max-w-[180px] truncate text-[11px] text-muted-foreground">{l.hiddenReason}</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {l.hiddenAt ? (
                            <button onClick={() => start(l.id, 'restore')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                              <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => start(l.id, 'hide')}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground hover:underline"
                              data-testid="hide-listing"
                            >
                              <EyeOff className="h-3.5 w-3.5" /> Hide
                            </button>
                          )}
                          <button onClick={() => start(l.id, 'remove')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-destructive hover:underline">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
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
