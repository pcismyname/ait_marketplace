'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Repeat,
  Plus,
  MessageCircle,
  Search,
  Menu,
  HandCoins,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useMarketplace } from '@/lib/store'
import { BRAND, getUser } from '@/lib/data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV = [
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/needs', label: 'Pre-arrival needs', icon: Sparkles },
  { href: '/rentals', label: 'My rentals', icon: HandCoins },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
]

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUserId, threads } = useMarketplace()
  const me = getUser(currentUserId)
  const [query, setQuery] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(query.trim() ? `/browse?q=${encodeURIComponent(query.trim())}` : '/browse')
  }

  const unread = threads.length

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Repeat className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            {BRAND}
          </span>
        </Link>

        <form onSubmit={onSearch} className="relative ml-2 hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search desks, bikes, textbooks…"
            className="h-10 w-full rounded-full border border-input bg-secondary/40 pl-9 pr-4 text-sm outline-none transition focus:border-ring focus:bg-background"
            aria-label="Search listings"
          />
        </form>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.href === '/chat' && unread > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Button
            render={<Link href="/sell" />}
            nativeButton={false}
            size="sm"
            className="rounded-full"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">List item</span>
          </Button>

          <Avatar className="hidden h-9 w-9 border border-border sm:flex">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
              {initials(me.name === 'You' ? 'You' : me.name)}
            </AvatarFallback>
          </Avatar>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Menu"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {NAV.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  render={<Link href={item.href} className="flex items-center gap-2" />}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
