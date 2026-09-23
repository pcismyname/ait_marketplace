// Money angle from the AIT Circular Marketplace proposal.
//
// - Peer-to-peer sales are free to list and free to complete.
// - Rentals pay a 10% commission plus a flat escrow handling fee, both taken
//   from the renter at booking time. The deposit is held in escrow and
//   refunded after the owner confirms the item came back in good condition.
// - Frequent listers can pay a small flat fee for premium placement.

/** Share of the rental fee kept by the platform on every rental booking. */
export const RENTAL_COMMISSION_RATE = 0.1

/** Flat fee (THB) per rental for holding the deposit and running disputes. */
export const ESCROW_HANDLING_FEE = 30

/** Flat fee (THB) for 7 days of top placement in search and matching. */
export const PREMIUM_PLACEMENT_FEE = 49

export interface RentalQuoteInput {
  /** Rental price for one rental period, in THB. */
  price: number
  /** Refundable deposit, in THB. Treated as zero when missing. */
  deposit?: number
}

export interface RentalQuote {
  rentalFee: number
  commission: number
  handlingFee: number
  deposit: number
  /** Commission plus handling fee: what the platform keeps. */
  platformFees: number
  /** Everything the renter pays at booking, including the deposit. */
  totalDueNow: number
  /** Amount returned to the renter after a confirmed return. */
  refundable: number
}

export function computeRentalQuote(input: RentalQuoteInput): RentalQuote {
  const rentalFee = input.price
  const deposit = input.deposit ?? 0
  const commission = Math.round(rentalFee * RENTAL_COMMISSION_RATE)
  const handlingFee = ESCROW_HANDLING_FEE
  const platformFees = commission + handlingFee
  return {
    rentalFee,
    commission,
    handlingFee,
    deposit,
    platformFees,
    totalDueNow: rentalFee + platformFees + deposit,
    refundable: deposit,
  }
}

const PERIOD_DAYS: Record<string, number> = {
  'per week': 7,
  'per month': 30,
  'per semester': 120,
}

/** Due date for a rental that starts on `start` and runs one rental period. */
export function rentalDueDate(start: Date, rentalPeriod: string | undefined): Date {
  const days = PERIOD_DAYS[rentalPeriod ?? ''] ?? PERIOD_DAYS['per semester']
  return new Date(start.getTime() + days * 86_400_000)
}
