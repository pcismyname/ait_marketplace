'use client'

import { Suspense, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { HandCoins, Inbox, ShieldCheck, Wallet } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { BRAND } from '@/lib/data'
import { DISPUTE_WINDOW_HOURS, OWNER_PAYOUT_DELAY_HOURS } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import type { Rental, RentalPhase } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RentalCard } from '@/components/rentals/rental-card'
import { DemoPaymentsNote } from '@/components/rentals/demo-payments-note'
import { useNow } from '@/components/rentals/use-now'
import { DEPOSIT_HELD_PHASES, OPEN_PHASES, nextDeadline, type RentalRole } from '@/components/rentals/rental-helpers'

type View = 'renting' | 'lending'

/** Most urgent first: things waiting on someone, then running rentals. */
const PHASE_ORDER: RentalPhase[] = [
  'requested',
  'approved',
  'paid',
  'overdue',
  'return-pending',
  'active',
  'disputed',
  'missing',
  'resolved',
  'released',
  'declined',
  'cancelled',
]

const byUrgency = (a: Rental, b: Rental) =>
  PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) ||
  new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()

export default function RentalsPage() {
  return (
    <Suspense fallback={null}>
      <RentalsView />
    </Suspense>
  )
}

function RentalsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { rentals, listings, currentUserId, loading, refresh } = useMarketplace()
  const now = useNow()

  // Fresh state on every visit: refresh() runs run_escrow_jobs first (overdue,
  // missing, payouts, auto-release), then reloads.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Reload when the next deadline (payout_at, due_date, dispute_window_ends_at) passes.
  useEffect(() => {
    const next = nextDeadline(rentals, new Date())
    if (next === null) return
    const delay = next - Date.now() + 5_000
    if (delay > 86_400_000) return
    const id = setTimeout(() => void refresh(), Math.max(delay, 1_000))
    return () => clearTimeout(id)
  }, [rentals, refresh])

  const renting = useMemo(
    () => rentals.filter((r) => r.renterId === currentUserId).sort(byUrgency),
    [rentals, currentUserId],
  )
  const lending = useMemo(
    () => rentals.filter((r) => r.ownerId === currentUserId).sort(byUrgency),
    [rentals, currentUserId],
  )

  const param = searchParams.get('view')
  const view: View =
    param === 'lending' || param === 'renting' ? param : renting.length === 0 && lending.length > 0 ? 'lending' : 'renting'
  const setView = (next: View) => router.replace(`/rentals?view=${next}`, { scroll: false })

  const depositsHeld = renting.filter((r) => DEPOSIT_HELD_PHASES.has(r.phase)).reduce((s, r) => s + r.deposit, 0)
  const pendingPayouts = lending
    .filter((r) => DEPOSIT_HELD_PHASES.has(r.phase) && !r.payoutReleasedAt)
    .reduce((s, r) => s + r.rentalFee, 0)
  const waitingRequests = lending.filter((r) => r.phase === 'requested').length
  const toPay = renting.filter((r) => r.phase === 'approved').length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-10">
        <p className="label-tag mb-2">My account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Rentals</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Bookings you made and items you lend out, from request to deposit release.
        </p>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-8">
        <TabsList variant="line" className="h-auto gap-6 border-b border-border pb-0">
          <TabsTrigger value="renting" className="px-0 pb-2 text-[13px]" data-testid="tab-renting">
            Renting{renting.length > 0 && <span className="text-muted-foreground"> · {renting.length}</span>}
            {toPay > 0 && <Badge>{toPay} to pay</Badge>}
          </TabsTrigger>
          <TabsTrigger value="lending" className="px-0 pb-2 text-[13px]" data-testid="tab-lending">
            Lending{lending.length > 0 && <span className="text-muted-foreground"> · {lending.length}</span>}
            {waitingRequests > 0 && <Badge>{waitingRequests} new</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="renting" className="space-y-10">
          {depositsHeld > 0 && (
            <SummaryStrip
              icon={ShieldCheck}
              label="Your deposits held in escrow"
              amount={depositsHeld}
              note={`${BRAND} holds deposits, never the owner. After the return there is a ${DISPUTE_WINDOW_HOURS}-hour window; with no dispute the deposit (minus any late fee) is refunded to your wallet automatically, or at once when the owner confirms a good return.`}
            />
          )}
          <RentalSections
            rentals={renting}
            role="renter"
            loading={loading}
            listings={listings}
            now={now}
            empty={
              <EmptyState
                title="No bookings yet"
                body="Rent furniture, appliances or gear for the semester. You pay only after the owner approves."
                href="/browse?type=rent"
                cta="Browse rentals"
              />
            }
          />
        </TabsContent>

        <TabsContent value="lending" className="space-y-10">
          {pendingPayouts > 0 && (
            <SummaryStrip
              icon={Wallet}
              label="Rental fees on their way to you"
              amount={pendingPayouts}
              note={`Each rental fee is paid to your wallet ${OWNER_PAYOUT_DELAY_HOURS} hours after handover. Deposits stay with ${BRAND} until the item is back.`}
            />
          )}
          <RentalSections
            rentals={lending}
            role="owner"
            loading={loading}
            listings={listings}
            now={now}
            empty={
              <EmptyState
                title="No booking requests yet"
                body="List an item for rent and requests from other students show up here."
                href="/sell"
                cta="List an item"
              />
            }
          />
        </TabsContent>
      </Tabs>

      <DemoPaymentsNote className="mt-12" />
    </div>
  )
}

function RentalSections({
  rentals,
  role,
  loading,
  listings,
  now,
  empty,
}: {
  rentals: Rental[]
  role: RentalRole
  loading: boolean
  listings: ReturnType<typeof useMarketplace>['listings']
  now: Date
  empty: React.ReactNode
}) {
  if (loading && rentals.length === 0) {
    return <p className="py-16 text-center text-[13px] text-muted-foreground">Loading your rentals…</p>
  }
  if (rentals.length === 0) return <>{empty}</>

  const requests = role === 'owner' ? rentals.filter((r) => r.phase === 'requested') : []
  const open = rentals.filter((r) => OPEN_PHASES.has(r.phase) && !(role === 'owner' && r.phase === 'requested'))
  const history = rentals.filter((r) => !OPEN_PHASES.has(r.phase))
  const card = (r: Rental) => (
    <RentalCard key={r.id} rental={r} role={role} listing={listings.find((l) => l.id === r.listingId)} now={now} />
  )

  return (
    <>
      {requests.length > 0 && (
        <Section title="Requests waiting for you" icon={Inbox} testId="section-requests">
          {requests.map(card)}
        </Section>
      )}
      {open.length > 0 && (
        <Section title="In progress" icon={HandCoins} testId="section-open">
          {open.map(card)}
        </Section>
      )}
      {history.length > 0 && (
        <Section title="History" testId="section-history">
          {history.map(card)}
        </Section>
      )}
    </>
  )
}

function Section({
  title,
  icon: Icon,
  testId,
  children,
}: {
  title: string
  icon?: typeof Inbox
  testId: string
  children: React.ReactNode
}) {
  return (
    <section data-testid={testId}>
      <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function SummaryStrip({
  icon: Icon,
  label,
  amount,
  note,
}: {
  icon: typeof Inbox
  label: string
  amount: number
  note: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-primary-muted p-5 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex items-center gap-4">
        <Icon className="h-6 w-6 shrink-0 text-primary" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{label}</p>
          <p className="font-display text-2xl font-bold text-foreground">{formatPrice(amount)}</p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground sm:ml-auto sm:max-w-md sm:text-right">{note}</p>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
      {children}
    </span>
  )
}

function EmptyState({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-20 text-center">
      <HandCoins className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
      <p className="mt-5 text-[14px] font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{body}</p>
      <Link
        href={href}
        className="mt-5 rounded-md bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  )
}
