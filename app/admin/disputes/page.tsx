'use client'

import { Search, AlertOctagon, MoreVertical } from 'lucide-react'

const DISPUTES = [
  { id: 'DSP-001', tx: 'TX-5821', buyer: 'Alex W.', seller: 'Priya S.', reason: 'Item not as described', status: 'Action Required', date: 'Oct 7, 2026' },
  { id: 'DSP-002', tx: 'TX-5492', buyer: 'Emma W.', seller: 'John D.', reason: 'Seller no-show', status: 'In Review', date: 'Oct 6, 2026' },
  { id: 'DSP-003', tx: 'TX-5103', buyer: 'Liam T.', seller: 'Sarah M.', reason: 'Item damaged', status: 'Resolved', date: 'Oct 1, 2026' },
]

export default function AdminDisputesPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen max-w-7xl mx-auto">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">Admin Portal</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Disputes</h1>
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
                <th className="px-6 py-4 border-b border-border">Status</th>
                <th className="px-6 py-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DISPUTES.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-6 py-4 font-semibold">{d.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-primary hover:underline cursor-pointer">{d.tx}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{d.buyer} <span className="text-muted-foreground font-normal">(Buyer)</span></p>
                    <p className="font-medium text-foreground mt-1">{d.seller} <span className="text-muted-foreground font-normal">(Seller)</span></p>
                  </td>
                  <td className="px-6 py-4">{d.reason}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      d.status === 'Resolved' ? 'bg-primary-muted text-primary' : 
                      d.status === 'Action Required' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {d.status === 'Action Required' && <AlertOctagon className="h-3 w-3" />}
                      {d.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      <MoreVertical className="h-4 w-4" />
                    </button>
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
