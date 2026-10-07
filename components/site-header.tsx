'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  Search, X, Heart, MessageCircle, User, Plus,
  AlignJustify, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMarketplace } from '@/lib/store'
import { CATEGORIES, getUser } from '@/lib/data'
import { initials } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AnnouncementBar } from '@/components/announcement-bar'

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUserId, threads, favoriteIds } = useMarketplace()
  const me = getUser(currentUserId)

  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const unread = threads.length
  const favCount = favoriteIds.size

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchOpen(false)
    router.push(query.trim() ? `/browse?q=${encodeURIComponent(query.trim())}` : '/browse')
    setQuery('')
  }

  const NAV_PAGES = [
    { href: '/browse', label: 'Browse' },
    { href: '/needs', label: 'Pre-arrival Needs' },
    { href: '/rentals', label: 'My Rentals' },
    { href: '/my-listings', label: 'My Listings' },
    { href: '/chat', label: 'Messages' },
  ]

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-border bg-background">

        {/* ── Main nav row ── */}
        <div className="relative mx-auto flex h-16 w-full items-center justify-between px-4 md:px-8 xl:px-12">

          {/* Logo (Left) */}
          <Link
            href="/"
            className="mr-6 shrink-0"
            aria-label="PassItOn home"
          >
            <Image
              src="/logo/passiton-logo.svg"
              alt="PassItOn"
              width={108}
              height={32}
              priority
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/logo/passiton-logo-reversed.svg"
              alt="PassItOn"
              width={108}
              height={32}
              priority
              className="h-7 w-auto hidden dark:block"
            />
          </Link>

          {/* Category nav — desktop (Centered) */}
          <nav className="hidden absolute left-1/2 -translate-x-1/2 lg:flex items-center gap-6" aria-label="Main navigation">
            {NAV_PAGES.map((page) => {
              const active = pathname === page.href || pathname.startsWith(`${page.href}?`)
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className={cn(
                    'text-[12px] font-semibold uppercase tracking-widest transition-colors whitespace-nowrap',
                    active ? 'text-foreground border-b-2 border-foreground py-1' : 'text-muted-foreground hover:text-foreground py-1 border-b-2 border-transparent',
                  )}
                >
                  {page.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex-1" />

          {/* Right icons — desktop */}
          <div className="hidden items-center md:flex">

            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open search"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            {/* Favorites */}
            <Link
              href="/browse?favorites=1"
              className="relative flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Favorites${favCount ? ` (${favCount})` : ''}`}
            >
              <Heart className="h-[18px] w-[18px]" />
              {favCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {favCount}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link
              href="/chat"
              className="relative flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Messages${unread ? ` (${unread} unread)` : ''}`}
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>

            {/* List item CTA */}
            <Link
              href="/sell"
              className="ml-2 flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3 w-3" />
              List
            </Link>

            {/* Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-2 flex h-7 w-7 items-center justify-center hover:opacity-80 transition-opacity outline-none" aria-label="Profile">
                <Avatar className="h-7 w-7 ring-1 ring-border">
                  <AvatarFallback className="bg-primary-muted text-[10px] font-bold text-primary">
                    {initials(me.name === 'You' ? 'SR' : me.name)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-1 rounded-md mt-2">
                <div className="px-2 py-2 border-b border-border mb-1">
                  <p className="text-[13px] font-medium">{me.name === 'You' ? 'Sami R.' : me.name}</p>
                  <p className="text-[11px] text-muted-foreground">{me.email || 'st123456@ait.asia'}</p>
                </div>
                <DropdownMenuItem render={<Link href="/my-listings" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] hover:bg-muted rounded-sm">
                  My Listings
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/rentals" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] hover:bg-muted rounded-sm">
                  My Rentals
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/orders" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] hover:bg-muted rounded-sm">
                  Orders
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/wallet" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] hover:bg-muted rounded-sm">
                  Wallet & Escrow
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] hover:bg-muted rounded-sm">
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 border-border" />
                <DropdownMenuItem render={<Link href="/login" />} className="flex cursor-pointer items-center px-3 py-2 text-[12px] text-destructive focus:text-destructive hover:bg-destructive/10 rounded-sm">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile right */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center text-muted-foreground"
              aria-label="Search"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center text-muted-foreground"
              aria-label="Menu"
            >
              <AlignJustify className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* ── Search overlay ── */}
        {searchOpen && (
          <div className="border-t border-border bg-background px-4 py-3 md:px-6">
            <form onSubmit={onSearch} className="mx-auto flex max-w-xl items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search furniture, bikes, textbooks…"
                  className="h-10 w-full rounded-sm border border-input bg-card pl-9 pr-4 text-[13px] outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </header>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <Image
                src="/logo/passiton-logo.svg"
                alt="PassItOn"
                width={90}
                height={28}
                className="h-6 w-auto dark:hidden"
              />
              <Image
                src="/logo/passiton-logo-reversed.svg"
                alt="PassItOn"
                width={90}
                height={28}
                className="h-6 w-auto hidden dark:block"
              />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-5 py-4">
              <p className="label-tag mb-3">Navigation</p>
              <div className="space-y-0.5">
                {NAV_PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-sm px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {page.label}
                  </Link>
                ))}
              </div>
            </nav>
            <div className="border-t border-border p-5">
              <Link
                href="/sell"
                onClick={() => setDrawerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                List an item
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
