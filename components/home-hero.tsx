'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, ArrowRight } from 'lucide-react'

export function HomeHero({ listingCount }: { listingCount: number }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(query.trim() ? `/browse?q=${encodeURIComponent(query.trim())}` : '/browse')
  }

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20 lg:py-24">

        {/* ── Two-column asymmetric layout ── */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:gap-16">

          {/* Left — headline */}
          <div className="lg:flex-[3]">
            {/* Section tag */}
            <p className="label-tag mb-5">
              Asian Institute of Technology · PassItOn Marketplace
            </p>

            {/* Headline — mix weight for rhythm, one serif italic moment */}
            <h1 className="text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.5rem]">
              The student market
              <br className="hidden sm:block" />
              {' '}for{' '}
              <span className="font-display italic text-primary">everything</span>
              <br className="hidden sm:block" />
              {' '}campus life needs.
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Furniture, electronics, bikes, textbooks. Sold, rented, or passed on
              — by students leaving to students arriving. Deposits held in escrow.
              No cash. No drama.
            </p>

            {/* Search bar */}
            <form onSubmit={onSearch} className="mt-7 flex max-w-sm gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you need?"
                  className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  aria-label="Search listings"
                />
              </div>
              <button
                type="submit"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </form>

            {/* Contextual links */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <Link href="/browse" className="font-medium text-foreground hover:text-primary transition-colors">
                {listingCount} items listed
              </Link>
              <span aria-hidden className="text-border">·</span>
              <Link href="/browse?type=rent" className="hover:text-primary transition-colors">
                Rent for a semester
              </Link>
              <span aria-hidden className="text-border">·</span>
              <Link href="/needs" className="hover:text-primary transition-colors">
                Register a pre-arrival need
              </Link>
            </div>
          </div>

          {/* Right — stats strip (Nexura pattern, but quiet) */}
          <div className="grid grid-cols-3 gap-0 divide-x divide-border rounded-xl border border-border bg-card lg:flex-[2] lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
            <Stat number="500+" label="Items in circulation" />
            <Stat number="4.9★" label="Average seller rating" />
            <Stat number="100%" label="AIT email verified" />
          </div>
        </div>

        {/* ── Trust strip — flat, no containers ── */}
        <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-6">
          {[
            'All sellers verified by AIT student email',
            'Rental deposits held in escrow until return',
            'Outgoing students matched to incoming cohorts',
            'Item history tracked across every resale',
          ].map((t) => (
            <span key={t} className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-5 text-center lg:items-start lg:text-left">
      <p className="font-display text-2xl font-bold text-primary lg:text-3xl">{number}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}
