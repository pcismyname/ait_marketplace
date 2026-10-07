'use client'

import { Plus, Building, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TRANSACTIONS = [
  { id: 'TX-1092', type: 'escrow_hold', amount: -500, date: 'Oct 7, 2026', label: 'Deposit held for "Mini Fridge"' },
  { id: 'TX-1085', type: 'payout', amount: 1200, date: 'Oct 1, 2026', label: 'Payout to K-Bank' },
  { id: 'TX-1042', type: 'escrow_release', amount: 800, date: 'Sep 25, 2026', label: 'Deposit released from "Office Chair"' },
  { id: 'TX-1011', type: 'sale', amount: 350, date: 'Sep 10, 2026', label: 'Sold "Calculus Textbook"' },
]

export default function WalletPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wallet & Escrow</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Manage your balances, deposits, and payouts.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Available Balance */}
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-[13px] font-medium text-muted-foreground">Available to Withdraw</p>
          <p className="mt-2 font-display text-4xl font-bold">฿1,550</p>
          <Button className="mt-6 w-full" size="sm">
            Withdraw Funds
          </Button>
        </div>

        {/* Escrow Balance */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-[13px] font-medium text-muted-foreground">Held in Escrow</p>
          <p className="mt-2 font-display text-4xl font-bold">฿500</p>
          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            Deposits currently held by PassItOn for active rentals. Will be released upon safe return.
          </p>
        </div>

        {/* Payment Method */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col">
          <p className="text-[13px] font-medium text-muted-foreground">Payout Method</p>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <Building className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium">Kasikornbank</p>
              <p className="text-[12px] text-muted-foreground">**** 4392</p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            <button className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
              <Plus className="h-3.5 w-3.5" />
              Add new account
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Recent Activity</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    tx.amount > 0 ? 'bg-primary-muted text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tx.amount > 0 ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium leading-none">{tx.label}</p>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">{tx.date} &middot; {tx.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.amount > 0 ? 'text-primary' : ''}`}>
                    {tx.amount > 0 ? '+' : ''}฿{Math.abs(tx.amount).toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {tx.type.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
