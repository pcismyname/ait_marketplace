import { ArrowRight, ShieldCheck, Repeat, HandCoins } from 'lucide-react'
import Link from 'next/link'
import {
  BUYER_PROTECTION_BASE_FEE,
  BUYER_PROTECTION_RATE,
  DISPUTE_WINDOW_HOURS,
  ESCROW_FEE_MIN,
  ESCROW_FEE_RATE,
  MISSING_AFTER_DAYS,
  OWNER_PAYOUT_DELAY_HOURS,
  RENTAL_COMMISSION_RATE,
  SALE_COMMISSION_RATE,
} from '@/lib/fees'

const pct = (rate: number) => `${Math.round(rate * 100)}%`

export default function HowItWorksPage() {
  return (
    <div className="w-full px-4 py-16 lg:px-12 xl:px-20 min-h-screen">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">How It Works</h1>
          <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground max-w-2xl mx-auto">
            PassItOn is designed exclusively for the AIT community. Our circular model ensures items stay on campus and incoming students can easily find what they need.
          </p>
        </div>

        <div className="space-y-16">
          <section className="border border-border bg-surface p-8 md:p-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center border border-primary text-primary bg-primary-muted">
                <Repeat className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">The Circular Economy</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-6">
              Every semester, outgoing students leave behind perfectly good furniture, appliances, and bicycles. Meanwhile, incoming students arrive and buy everything brand new. PassItOn bridges this gap. By registering what you need before you arrive, we match you directly with students who are moving out.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 text-[13px]">
              <div className="border border-border p-5 bg-background">
                <p className="font-semibold mb-2">For Outgoing Students</p>
                <p className="text-muted-foreground">List your items weeks before you leave. Pre-sell them to incoming students and coordinate a handoff date that works for both.</p>
              </div>
              <div className="border border-border p-5 bg-background">
                <p className="font-semibold mb-2">For Incoming Students</p>
                <p className="text-muted-foreground">Post a &ldquo;Need&rdquo; before you even arrive in Thailand. We&apos;ll automatically notify you when matching items are listed.</p>
              </div>
            </div>
          </section>

          <section className="border border-border bg-surface p-8 md:p-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center border border-primary text-primary bg-primary-muted">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Escrow Protection</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-6">
              Listing is always free. When you buy, you choose how to pay. Paying in person is free, but
              PassItOn can&apos;t step in if something goes wrong. Paying with protection lets us hold the
              money until the handover is done.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 text-[13px] mb-8">
              <div className="border border-border p-5 bg-background">
                <p className="font-semibold mb-2">Pay in person</p>
                <p className="text-muted-foreground">Pay the seller directly at pickup. Free, with no escrow and no dispute support.</p>
              </div>
              <div className="border border-border p-5 bg-background">
                <p className="font-semibold mb-2">Pay with protection</p>
                <p className="text-muted-foreground">
                  ฿{BUYER_PROTECTION_BASE_FEE} + {pct(BUYER_PROTECTION_RATE)} of the price. The money is held until
                  the handover plus {DISPUTE_WINDOW_HOURS} hours, and you can open a dispute in that window. The
                  seller pays a {pct(SALE_COMMISSION_RATE)} commission out of their payout.
                </p>
              </div>
            </div>
            <ul className="space-y-4 text-[13px] text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">1.</span>
                Buyer pays through PassItOn with PromptPay, card or wallet.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">2.</span>
                PassItOn holds the money in escrow. The seller doesn&apos;t receive it yet.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">3.</span>
                Buyer and seller meet on campus. Buyer inspects the item.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">4.</span>
                The money goes to the seller, minus a {pct(SALE_COMMISSION_RATE)} sale commission,{' '}
                {DISPUTE_WINDOW_HOURS} hours after the handover, unless the buyer opens a dispute. Confirming receipt early releases it straight away.
              </li>
            </ul>
          </section>

          <section className="border border-border bg-surface p-8 md:p-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center border border-primary text-primary bg-primary-muted">
                <HandCoins className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Renting Made Safe</h2>
            </div>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-6">
              Don&apos;t want to buy? Rent items for a week, a month or a semester. PassItOn holds the security
              deposit, so the owner never handles it.
            </p>
            <ul className="space-y-4 text-[13px] text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">1.</span>
                Send a booking request. Once the owner approves, you pay the rental fee, a {pct(RENTAL_COMMISSION_RATE)} commission,
                an escrow fee (฿{ESCROW_FEE_MIN} or {pct(ESCROW_FEE_RATE)} of the deposit, whichever is higher) and the refundable deposit.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">2.</span>
                The owner receives the rental fee {OWNER_PAYOUT_DELAY_HOURS} hours after handover if no dispute is filed.
                The deposit stays held until the item comes back.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">3.</span>
                On return, the owner checks the condition against the handover photos. Confirming releases your
                deposit; with no claim, it releases automatically after {DISPUTE_WINDOW_HOURS} hours.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">4.</span>
                Late returns cost a daily late fee taken from the deposit. More than {MISSING_AFTER_DAYS} days late
                counts as missing, and the full deposit goes to the owner. You never lose more than the deposit.
              </li>
            </ul>
          </section>

          <div className="text-center pt-8">
            {/* Only signed-in students reach this page (AuthGuard), so send them to browse, not /signup. */}
            <Link href="/browse" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-[13px] font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
              Start browsing <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
