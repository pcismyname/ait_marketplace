'use client'

import { Users, AlertTriangle, FileText, Activity } from 'lucide-react'
import Link from 'next/link'

const STATS = [
  { label: 'Total Users', value: '1,248', icon: Users },
  { label: 'Active Listings', value: '432', icon: FileText },
  { label: 'Active Disputes', value: '3', icon: AlertTriangle, alert: true },
  { label: 'Transactions Today', value: '12', icon: Activity },
]

export default function AdminDashboardPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-7xl mx-auto">
      <div className="mb-12">
        <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Admin Portal</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
        {STATS.map((stat, i) => (
          <div key={i} className="border border-border bg-surface p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-muted-foreground">{stat.label}</p>
              <stat.icon className={`h-5 w-5 ${stat.alert ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <p className="font-display text-4xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="border border-border bg-surface">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Recent Disputes</h2>
            <Link href="/admin/disputes" className="text-[12px] font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="p-5 hover:bg-muted/50 transition-colors">
                <div className="flex justify-between mb-1">
                  <p className="text-[13px] font-semibold">TX-582{i}</p>
                  <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider">Unresolved</span>
                </div>
                <p className="text-[12px] text-muted-foreground">Buyer reported item not as described.</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-surface">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Flagged Listings</h2>
            <Link href="/admin/listings" className="text-[12px] font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {[1, 2].map((_, i) => (
              <div key={i} className="p-5 hover:bg-muted/50 transition-colors">
                <div className="flex justify-between mb-1">
                  <p className="text-[13px] font-semibold">L-902{i}</p>
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Under Review</span>
                </div>
                <p className="text-[12px] text-muted-foreground">Multiple reports of inappropriate content.</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
