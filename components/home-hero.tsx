'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Repeat, ShieldCheck, CalendarClock, BadgeCheck } from 'lucide-react'

const TRUST = [
  { icon: BadgeCheck, label: 'Verified via AIT student email' },
  { icon: ShieldCheck, label: 'Rental deposits held in escrow' },
  { icon: CalendarClock, label: 'Outgoing students matched to incoming' },
  { icon: Repeat, label: 'Items circulate cohort to cohort' },
]

export function HomeHero({ listingCount }: { listingCount: number }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(query.trim() ? `/browse?q=${encodeURIComponent(query.trim())}` : '/browse')
  }

  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/50 to-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            The circular marketplace for the Asian Institute of Technology
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
            Buy, sell and rent everything for AIT life.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
            One searchable place for furniture, electronics, bikes, textbooks and kitchen
            gear, passed from the cohort leaving to the cohort arriving. Rent for a
            semester instead of buying forever, with the deposit held safely in escrow.
          </p>

          <form onSubmit={onSearch} className="mt-6 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="h-12 w-full rounded-full border border-input bg-background pl-11 pr-4 text-sm outline-none transition focus:border-ring"
                aria-label="Search listings"
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {TRUST.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground"
              >
                <t.icon className="h-4 w-4 text-primary" />
                {t.label}
              </span>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/browse" className="font-semibold text-foreground hover:underline">
              {listingCount} items
            </Link>{' '}
            available on campus right now ·{' '}
            <Link href="/browse?type=rent" className="font-semibold text-foreground hover:underline">
              see what you can rent
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
