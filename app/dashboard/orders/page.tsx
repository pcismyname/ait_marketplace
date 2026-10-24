'use client'

// Purchase, sale and rental history from the real deals (transactions and
// rentals tables, kept live by the store's Realtime subscriptions). Every row
// links to the deal's status page, /transaction/[id]. Amounts are the stored
// columns (total, price, total_paid, rental_fee), never recomputed.
// Declined / cancelled deals moved no money (BusinessRules §4 rental states),
// so they show "No charge" instead of a price.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Key, Package, ShoppingBag, Store } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import type { Rental, Transaction } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { dealStatus, formatDate, TONE_CLASS } from '@/lib/deal-status'
import { cn } from '@/lib/utils'

type Tab = 'purchases' | 'sales' | 'renting' | 'lending'

interface OrderRow {
  id: string
  title: string
  counterpart: string
  date: string
  /** null: no money moved (declined / cancelled before payment). */
  amount: number | null
  amountNote: string
  status: { label: string; tone: keyof typeof TONE_CLASS }
}

export default function OrdersPage() {
  const { transactions, rentals, listings, getUser, currentUserId, loading } = useMarketplace()
  const [tab, setTab] = useState<Tab>('purchases')

  const titleOf = useMemo(() => {
    const byId = new Map(listings.map((l) => [l.id, l.title]))
    return (listingId: string) => byId.get(listingId) ?? 'Item'
  }, [listings])

  const rows = useMemo(() => {
    const sale = (t: Transaction, side: 'buyer' | 'seller'): OrderRow => ({
      id: t.id,
      title: titleOf(t.listingId),
      counterpart: side === 'buyer' ? `from ${getUser(t.sellerId).name}` : t.buyerId ? `to ${getUser(t.buyerId).name}` : 'buyer not recorded',
      date: t.createdAt,
      amount: t.status === 'cancelled' ? null : side === 'buyer' ? t.total : t.sellerAmount ?? t.price,
      amountNote:
        t.status === 'cancelled'
          ? 'Cancelled · no charge'
          : t.mode === 'protected'
          ? side === 'buyer'
            ? `Protected · incl. ${formatPrice(t.protectionFee)} fee`
            : 'Protected · paid out after the window'
          : 'Paid in person · no protection',
      status: dealStatus({ kind: 'sale', transaction: t }),
    })
    const rental = (r: Rental, side: 'renter' | 'owner'): OrderRow => {
      const closedUnpaid = (r.phase === 'declined' || r.phase === 'cancelled') && r.totalPaid === undefined
      return {
        id: r.id,
        title: titleOf(r.listingId),
        counterpart: side === 'renter' ? `from ${getUser(r.ownerId).name}` : `to ${getUser(r.renterId).name}`,
        date: r.requestedAt,
        amount: closedUnpaid
          ? null
          : side === 'renter'
            ? r.totalPaid ?? r.quote?.totalDueNow ?? r.rentalFee + r.commission + r.escrowFee + r.deposit
            : r.rentalFee,
        amountNote: closedUnpaid
          ? `${r.phase === 'declined' ? 'Declined' : 'Cancelled'} · no charge`
          : side === 'renter'
            ? `${r.totalPaid !== undefined ? 'Paid' : 'Due'} · incl. ${formatPrice(r.deposit)} deposit`
            : `Rental fee${r.rentalPeriod ? ` ${r.rentalPeriod}` : ''}${r.payoutReleasedAt ? ' · paid out' : ''}`,
        status: dealStatus({ kind: 'rental', rental: r }),
      }
    }
    return {
      purchases: transactions.filter((t) => t.buyerId === currentUserId).map((t) => sale(t, 'buyer')),
      sales: transactions.filter((t) => t.sellerId === currentUserId).map((t) => sale(t, 'seller')),
      renting: rentals.filter((r) => r.renterId === currentUserId).map((r) => rental(r, 'renter')),
      lending: rentals.filter((r) => r.ownerId === currentUserId).map((r) => rental(r, 'owner')),
    } satisfies Record<Tab, OrderRow[]>
  }, [transactions, rentals, currentUserId, getUser, titleOf])

  const TABS: { id: Tab; label: string; icon: typeof Package; empty: string; cta?: { href: string; label: string } }[] = [
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag, empty: 'When you buy an item, it shows up here.', cta: { href: '/browse', label: 'Browse the marketplace' } },
    { id: 'sales', label: 'Sales', icon: Store, empty: 'Items people buy from you show up here.', cta: { href: '/sell', label: 'List an item' } },
    { id: 'renting', label: 'Renting', icon: Key, empty: 'Items you rent show up here.', cta: { href: '/browse?type=rent', label: 'Find a rental' } },
    { id: 'lending', label: 'Lending', icon: Package, empty: 'Bookings for items you rent out show up here.' },
  ]
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]
  const list = rows[tab]

  return (
    <div className="space-y-10">
      <div>
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Everything you bought, sold, rented and lent.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Order type">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors',
                tab === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{rows[t.id].length}</span>
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border py-16 text-center">
          <h3 className="text-lg font-semibold tracking-tight">{loading ? 'Loading…' : `No ${active.label.toLowerCase()} yet`}</h3>
          {!loading && <p className="mt-1 text-[13px] text-muted-foreground">{active.empty}</p>}
          {!loading && active.cta && (
            <Link
              href={active.cta.href}
              className="mt-6 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              {active.cta.label}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card" data-testid="orders-list">
          {list.map((row) => (
            <li key={row.id}>
              <Link
                href={`/transaction/${row.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_140px_170px_20px] sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{row.title}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {row.counterpart} · {formatDate(row.date)}
                  </p>
                </div>
                <div className="text-right sm:text-left">
                  <p className={cn('font-semibold tabular-nums', row.amount === null && 'text-muted-foreground')}>
                    {row.amount === null ? '—' : formatPrice(row.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.amountNote}</p>
                </div>
                <span
                  className={cn(
                    'w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    TONE_CLASS[row.status.tone],
                  )}
                >
                  {row.status.label}
                </span>
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
