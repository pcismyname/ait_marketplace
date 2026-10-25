'use client'

// Premium placement on the sell and edit forms (BusinessRules §2): the lister
// pays ฿49 (simulated, §7) for 7 days at the top of browse and search. The
// charge is the enable_premium_placement RPC; ending early is
// end_premium_placement and refunds nothing.

import { PAYMENT_METHODS } from '@/lib/data'
import { PREMIUM_PLACEMENT_DAYS, PREMIUM_PLACEMENT_FEE } from '@/lib/fees'
import { formatPrice } from '@/lib/format'
import { enablePremiumPlacement, endPremiumPlacement } from '@/lib/api/listing-owner'
import type { Listing, PaymentMethod } from '@/lib/types'
import { SimulatedPaymentsNote } from '@/components/simulated-payments-note'
import { cn } from '@/lib/utils'

export const premiumEndLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * Below the premium toggle: the payment method and what happens on save.
 * `activeUntil` is set when the listing already has premium placement.
 */
export function PremiumPaymentFields({
  premium, method, onMethodChange, active, activeUntil, action, className,
}: {
  premium: boolean
  method: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  /** The listing already has premium placement. */
  active: boolean
  activeUntil?: string
  /** "publish" or "save": the button the charge happens on. */
  action: 'publish' | 'save'
  className?: string
}) {
  if (active) {
    return (
      <div className={cn('space-y-1', className)} data-testid="premium-status">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {activeUntil ? <>Active until {premiumEndLabel(activeUntil)}.</> : <>Active.</>}
          {!premium && <> Saving now ends it early, with no refund.</>}
        </p>
      </div>
    )
  }
  if (!premium) return null
  return (
    <div className={cn('space-y-2.5', className)} data-testid="premium-payment">
      <p className="text-[12px] leading-relaxed text-foreground">
        You pay {formatPrice(PREMIUM_PLACEMENT_FEE)} when you {action}, for {PREMIUM_PLACEMENT_DAYS} days from then.
      </p>
      <div role="radiogroup" aria-label="Pay for premium placement with" className="flex flex-wrap gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={method === m.id}
            onClick={() => onMethodChange(m.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
              method === m.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <SimulatedPaymentsNote />
    </div>
  )
}

/**
 * After the listing is saved: buy or end premium placement to match the
 * toggle. Returns what changed; throws an ApiError when the charge fails.
 */
export async function syncPremiumPlacement(
  listing: Pick<Listing, 'id' | 'featured'>,
  wanted: boolean,
  method: PaymentMethod,
): Promise<{ change: 'enabled' | 'ended' | null; listing?: Listing }> {
  const active = Boolean(listing.featured)
  if (wanted && !active) return { change: 'enabled', listing: await enablePremiumPlacement(listing.id, method) }
  if (!wanted && active) return { change: 'ended', listing: await endPremiumPlacement(listing.id) }
  return { change: null }
}
