import Link from 'next/link'
import {
  CalendarClock,
  HandCoins,
  Repeat,
  SlidersHorizontal,
  Store,
  Tag,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import {
  ESCROW_HANDLING_FEE,
  PREMIUM_PLACEMENT_FEE,
  RENTAL_COMMISSION_RATE,
} from '@/lib/fees'
import { formatPrice } from '@/lib/format'

const DIFFERENCES = [
  {
    icon: CalendarClock,
    title: 'Calendar-aware matching',
    body: "AIT's intake and move-out dates are fixed. Listings from students leaving in November surface to students arriving in January — pre-registered needs are matched automatically.",
    href: '/needs',
    cta: 'Register a need',
  },
  {
    icon: HandCoins,
    title: 'Rent a semester, not a lifetime',
    body: 'A rice cooker for one semester does not need to be bought outright. The platform holds a refundable deposit — the accountability a LINE chat cannot provide.',
    href: '/browse?type=rent',
    cta: 'Browse rentals',
  },
  {
    icon: Repeat,
    title: 'Items tracked across cohorts',
    body: 'The same desk can survive three theses. Every listing shows how many times it has stayed inside the AIT community. That is a visible circular economy.',
    href: '/listing/l_desk',
    cta: 'See an item history',
  },
  {
    icon: SlidersHorizontal,
    title: 'Filters a chat feed cannot offer',
    body: 'Category, price range, sale vs. rent, campus pickup location. No scrolling past posts buried after one hour.',
    href: '/browse',
    cta: 'Browse everything',
  },
] as { icon: LucideIcon; title: string; body: string; href: string; cta: string }[]

export function WhySection() {
  return (
    <section>
      {/* Header — left-aligned, not centered */}
      <div className="mb-8">
        <p className="label-tag mb-2">Why this exists</p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          What changes when the
          {' '}
          <span className="font-display italic text-primary">marketplace is structured</span>
        </h2>
        <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
          Scattered LINE groups and Facebook posts work, but poorly. Search buries items in hours.
          Trust is informal. Rentals are cash and awkward. Here is what this fixes.
        </p>
      </div>

      {/* Feature grid — 2-column, no identical card layout */}
      <div className="grid gap-5 sm:grid-cols-2">
        {DIFFERENCES.map((d, i) => (
          <div
            key={d.title}
            className={`flex flex-col gap-3 ${i === 0 ? 'rounded-xl bg-primary p-5 text-primary-foreground' : 'rounded-xl border border-border bg-card p-5'}`}
          >
            <d.icon className={`h-5 w-5 ${i === 0 ? 'text-primary-foreground/70' : 'text-primary'}`} aria-hidden />
            <h3 className={`font-semibold leading-snug ${i === 0 ? '' : 'text-foreground'}`}>
              {d.title}
            </h3>
            <p className={`flex-1 text-[13px] leading-relaxed text-pretty ${i === 0 ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {d.body}
            </p>
            <Link
              href={d.href}
              className={`inline-flex items-center gap-1 text-[12px] font-semibold hover:underline underline-offset-2 ${i === 0 ? 'text-primary-foreground' : 'text-primary'}`}
            >
              {d.cta} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Pricing strip — clean table, no card bloat */}
      <div className="mt-5 rounded-xl border border-border bg-surface">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <PriceRow
            icon={Tag}
            title="Peer-to-peer sales"
            price="Free"
            note="No listing or completion fee."
          />
          <PriceRow
            icon={HandCoins}
            title="Rentals"
            price={`${Math.round(RENTAL_COMMISSION_RATE * 100)}% + ${formatPrice(ESCROW_HANDLING_FEE)}`}
            note="Commission + escrow fee at booking."
          />
          <PriceRow
            icon={Sparkles}
            title="Premium placement"
            price={formatPrice(PREMIUM_PLACEMENT_FEE)}
            note="7 days at top of search and matching."
          />
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <Store className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Campus shops list alongside students under the same escrow rules.
        </div>
      </div>
    </section>
  )
}

function PriceRow({
  icon: Icon,
  title,
  price,
  note,
}: {
  icon: LucideIcon
  title: string
  price: string
  note: string
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide">{title}</p>
        <p className="mt-0.5 font-display text-base font-bold text-primary">{price}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}
