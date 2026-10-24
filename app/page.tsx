'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BrowseSearch, ListingBrowser } from '@/components/listing-browser'

// Home and /browse: search box, filter bar and the listing grid, all driven
// by the URL (?q=, ?type=, ?category=, …) and queried from the database.
function HomeInner() {
  return (
    <div>
      {/* ── Editorial Search Hero ── */}
      <BrowseSearch />

      {/* Filter bar + product grid */}
      <ListingBrowser />

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
            <div className="sm:w-52 shrink-0">
              <Image
                src="/logo/passiton-logo.svg"
                alt="PassItOn"
                width={120}
                height={36}
                className="h-8 w-auto dark:hidden"
              />
              <Image
                src="/logo/passiton-logo-reversed.svg"
                alt="PassItOn"
                width={120}
                height={36}
                className="h-8 w-auto hidden dark:block"
              />
              <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
                Student-only circular marketplace for AIT.
                Buy, sell, and rent — cohort to cohort.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                AIT email verified only
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3 flex-1">
              <FooterGroup title="Marketplace" links={[
                { href: '/', label: 'Browse all' },
                { href: '/?type=rent', label: 'For rent' },
                { href: '/my-listings', label: 'My listings' },
                { href: '/sell', label: 'List an item' },
              ]} />
              <FooterGroup title="Account" links={[
                { href: '/needs', label: 'Pre-arrival needs' },
                { href: '/rentals', label: 'My rentals' },
                { href: '/chat', label: 'Messages' },
              ]} />
              <FooterGroup title="Course project" links={[
                { label: 'AST02.21 — E-Business' },
                { label: 'Samichi · Chidsanuphong · Lucja' },
              ]} />
            </div>
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-[11px] text-muted-foreground">
            <p>© {new Date().getFullYear()} PassItOn</p>
            <p className="hidden sm:block">For students, by students · Asian Institute of Technology</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterGroup({ title, links }: { title: string; links: { href?: string; label: string }[] }) {
  return (
    <div>
      <p className="label-tag mb-3">{title}</p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.href
              ? <Link href={l.href} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
              : <span className="text-[12px] text-muted-foreground">{l.label}</span>
            }
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] animate-pulse bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  )
}
