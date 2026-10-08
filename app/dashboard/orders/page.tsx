'use client'

import { Package, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const ORDERS = [
  { id: 'ORD-5821', title: 'Calculus Early Transcendentals 8th Ed', seller: 'Priya S.', date: 'Oct 5, 2026', price: 450, status: 'completed' },
  { id: 'ORD-5492', title: 'Desk Lamp (IKEA)', seller: 'John D.', date: 'Sep 12, 2026', price: 150, status: 'completed' },
  { id: 'ORD-5103', title: 'Bicycle U-Lock', seller: 'Emma W.', date: 'Aug 28, 2026', price: 200, status: 'completed' },
]

export default function OrdersPage() {
  return (
    <div className="space-y-10">
      <div className="mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Purchase History</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">Items you have bought on PassItOn.</p>
      </div>

      {ORDERS.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight">No orders yet</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">When you buy an item, it will show up here.</p>
          <Link
            href="/browse"
            className="mt-6 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ORDERS.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-6 py-4 font-medium">{order.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{order.title}</p>
                      <p className="text-[12px] text-muted-foreground">from {order.seller}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">{order.date}</td>
                    <td className="whitespace-nowrap px-6 py-4 font-semibold">฿{order.price}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {order.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline">
                        Receipt <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
