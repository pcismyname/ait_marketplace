'use client'

import { Search, ShieldAlert, Check } from 'lucide-react'

const LISTINGS = [
  { id: 'LST-892', title: 'Suspicious Rolex Watch', seller: 'User129', reports: 4, status: 'Flagged', date: 'Oct 7, 2026' },
  { id: 'LST-743', title: 'Calculus Test Answers', seller: 'St2026', reports: 2, status: 'Hidden', date: 'Oct 6, 2026' },
  { id: 'LST-102', title: 'Normal Bicycle', seller: 'Emma W.', reports: 1, status: 'Reviewed', date: 'Sep 20, 2026' },
]

export default function AdminListingsPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Admin Portal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Listing Moderation</h1>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search listings..." 
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
                <th className="px-6 py-4 border-b border-border">Title</th>
                <th className="px-6 py-4 border-b border-border">Seller</th>
                <th className="px-6 py-4 border-b border-border">Reports</th>
                <th className="px-6 py-4 border-b border-border">Status</th>
                <th className="px-6 py-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LISTINGS.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-6 py-4 font-semibold">{l.id}</td>
                  <td className="px-6 py-4 font-medium">{l.title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-primary hover:underline cursor-pointer">{l.seller}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-bold text-destructive">{l.reports}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      l.status === 'Reviewed' ? 'bg-primary-muted text-primary' : 
                      l.status === 'Hidden' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {l.status === 'Flagged' && <ShieldAlert className="h-3 w-3" />}
                      {l.status === 'Reviewed' && <Check className="h-3 w-3" />}
                      {l.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button className="text-[12px] font-semibold text-primary hover:underline">Review</button>
                      <button className="text-[12px] font-semibold text-destructive hover:underline">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
