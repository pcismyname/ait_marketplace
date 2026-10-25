'use client'

// Users (P2): read-only list of profiles with an admin badge. Admin rights are
// set in the database only (users.is_admin), never from the app.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, ShieldCheck, Store } from 'lucide-react'
import { listAllUsers } from '@/lib/api/moderation'
import type { User } from '@/lib/types'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listAllUsers().then(setUsers, (e: Error) => setError(e.message))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users ?? []).filter((u) => !q || `${u.name} ${u.email ?? ''} ${u.program}`.toLowerCase().includes(q))
  }, [users, query])

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="label-tag mb-2">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Users</h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
            Everyone signed up with an AIT email. Admin rights are granted in the database, not here.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">Could not load users: {error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {users === null ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]" data-testid="user-table">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-5 py-3">Name</th>
                  <th className="border-b border-border px-5 py-3">Email</th>
                  <th className="border-b border-border px-5 py-3">Program</th>
                  <th className="border-b border-border px-5 py-3">Rating</th>
                  <th className="border-b border-border px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link href={`/profile/${u.id}`} className="font-semibold hover:text-primary hover:underline">
                        {u.name}
                      </Link>
                      {u.isAdmin && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      )}
                      {u.kind === 'shop' && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          <Store className="h-3 w-3" /> Shop
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{u.email ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                      {[u.program, u.batch].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {u.reviewsCount > 0 ? `${u.rating.toFixed(1)} (${u.reviewsCount})` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{u.joined || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
