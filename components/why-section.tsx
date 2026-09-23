import Link from 'next/link'
import {
  CalendarClock,
  HandCoins,
  Repeat,
  SlidersHorizontal,
  Store,
  Tag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeader } from '@/components/section-header'
import {
  ESCROW_HANDLING_FEE,
  PREMIUM_PLACEMENT_FEE,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'

const DIFFERENCES: { icon: LucideIcon; title: string; body: string; href: string; cta: string }[] = [
  {
    icon: CalendarClock,
    title: 'Calendar-aware matching',
    body: "AIT's intake and move-out dates are fixed and known. Listings from students leaving in November surface to students arriving in January, and needs registered before landing in Thailand are matched automatically.",
    href: '/needs',
    cta: 'Register a need',
  },
  {
    icon: HandCoins,
    title: 'Rent as a first-class option',
    body: 'A textbook for one course or a rice cooker for one semester does not have to be bought outright. The platform holds a refundable deposit, the trust mechanism a chat group structurally cannot provide.',
    href: '/browse?type=rent',
    cta: 'Browse rentals',
  },
  {
    icon: Repeat,
    title: 'Item lifecycle tracking',
    body: 'The same rice cooker can be sold, used for a year and resold to the next cohort. Every listing shows how many times it has stayed inside the AIT community: a visible circular economy.',
    href: '/listing/l_bike',
    cta: 'See an item history',
  },
  {
    icon: SlidersHorizontal,
    title: 'Search a chat feed cannot offer',
    body: 'Filter by category, price, sale versus rent and campus pickup location, instead of scrolling past posts that got buried within hours.',
    href: '/browse',
    cta: 'Browse everything',
  },
]

export function WhySection() {
  return (
    <section>
      <SectionHeader
        title="Why not just a Facebook group?"
        subtitle="Scattered groups and LINE chats work, but poorly. Here is what changes when the marketplace is structured."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {DIFFERENCES.map((d) => (
          <div
            key={d.title}
            className="flex flex-col rounded-3xl border border-border bg-card p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <d.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-base font-bold">{d.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{d.body}</p>
            <Link
              href={d.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {d.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl border border-border bg-secondary/40 p-5 sm:grid-cols-3">
        <MoneyItem
          icon={Tag}
          title="Sales stay free"
          body="Peer-to-peer sales carry no fee, so the core group-chat replacement stays frictionless."
        />
        <MoneyItem
          icon={HandCoins}
          title={`Rentals: ${Math.round(RENTAL_COMMISSION_RATE * 100)}% + ${formatPrice(ESCROW_HANDLING_FEE)}`}
          body="A commission plus a flat escrow handling fee, taken at booking, pays for holding deposits and resolving disputes."
        />
        <MoneyItem
          icon={Sparkles}
          title={`Premium placement ${formatPrice(PREMIUM_PLACEMENT_FEE)}`}
          body="Frequent listers can pay for 7 days at the top of search and matching."
        />
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:col-span-3">
          <Store className="h-3.5 w-3.5" />
          Campus shops list new stock and rental fleets alongside students, under the same
          escrow rules.
        </p>
      </div>
    </section>
  )
}

function MoneyItem({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{body}</p>
      </div>
    </div>
  )
}
