'use client'

// Admin area guard: only users with users.is_admin (set in the database, never
// from the app). The RPCs and RLS enforce it on the server; this is the UI.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gavel, LayoutDashboard, Loader2, Lock, Tags, Users } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND } from '@/lib/data'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/disputes', label: 'Disputes', icon: Gavel },
  { href: '/admin/listings', label: 'Listings', icon: Tags },
  { href: '/admin/users', label: 'Users', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { loading, currentUserId, currentUser, isAdmin } = useMarketplace()

  if (loading || (currentUserId && !currentUser)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center" data-testid="admin-forbidden">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <p className="label-tag mb-2">Error 403</p>
        <h1 className="text-2xl font-semibold tracking-tight">This area is for the {BRAND} team</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          You need an admin account to see disputes and moderation tools. If you have a problem with a deal, open it
          from your rentals or orders and file a dispute there.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-[13px] font-semibold">
          <Link href="/" className="text-primary hover:underline">
            Back to the marketplace
          </Link>
          <Link href="/rentals" className="text-primary hover:underline">
            My rentals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <p className="label-tag">{BRAND} admin</p>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto" aria-label="Admin">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                  active ? 'bg-primary-muted text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}
