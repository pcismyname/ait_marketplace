import { ArrowRight, ShieldCheck, Repeat, HandCoins } from 'lucide-react'
import Link from 'next/link'

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
                <p className="text-muted-foreground">Post a "Need" before you even arrive in Thailand. We'll automatically notify you when matching items are listed.</p>
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
              We hold all payments securely until the item is handed over and verified. This protects both the buyer and the seller from no-shows and misrepresentations.
            </p>
            <ul className="space-y-4 text-[13px] text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">1.</span>
                Buyer pays through PassItOn using PromptPay or Credit Card.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">2.</span>
                Funds are held in our secure escrow account.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">3.</span>
                Buyer and seller meet on campus. Buyer inspects the item.
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">4.</span>
                Buyer confirms receipt in the app, and funds are instantly released to the seller's wallet.
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
              Don't want to buy? Rent items for a semester. Our platform handles the security deposit so you don't have to worry about cash.
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              When renting, you pay the rental fee plus a refundable security deposit. PassItOn holds the deposit in escrow for the duration of the rental. Once you return the item in good condition, the owner confirms receipt and your deposit is immediately refunded.
            </p>
          </section>

          <div className="text-center pt-8">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-[13px] font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
              Join PassItOn <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
