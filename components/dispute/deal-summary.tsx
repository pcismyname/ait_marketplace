'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useMarketplace } from '@/lib/store'
import { formatPrice } from '@/lib/format'
import type { Listing, Rental, Transaction } from '@/lib/types'
import { formatDateTime } from './dispute-helpers'

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</dd>
    </div>
  )
}

/** The rental or protected purchase a dispute is about, with every amount from its database row. */
export function DealSummary({
  rental,
  transaction,
  listing,
  showDealLink = true,
}: {
  rental?: Rental
  transaction?: Transaction
  listing?: Listing
  showDealLink?: boolean
}) {
  const { getUser } = useMarketplace()
  const dealId = rental?.id ?? transaction?.id

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-tag">{rental ? 'Rental' : 'Protected purchase'}</p>
          <h2 className="mt-1 truncate text-[15px] font-semibold">
            {listing ? (
              <Link href={`/listing/${listing.id}`} className="hover:underline">
                {listing.title}
              </Link>
            ) : (
              'Listing removed'
            )}
          </h2>
        </div>
        {showDealLink && dealId && (
          <Link
            href={`/transaction/${dealId}`}
            className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            Deal status <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {rental && (
        <dl className="divide-y divide-border">
          <Row label="Renter" value={getUser(rental.renterId).name} />
          <Row label="Owner" value={getUser(rental.ownerId).name} />
          <Row label="Rental fee" value={formatPrice(rental.rentalFee)} />
          <Row label={rental.releasedAt ? 'Deposit (was held in escrow)' : 'Deposit held in escrow'} value={formatPrice(rental.deposit)} strong />
          {rental.lateFee > 0 && (
            <Row label={`Late fee (${rental.lateDays} day${rental.lateDays === 1 ? '' : 's'}, from the deposit)`} value={formatPrice(rental.lateFee)} />
          )}
          <Row label="Handed over" value={formatDateTime(rental.handoverAt)} />
          <Row label="Returned" value={formatDateTime(rental.returnedAt)} />
          <Row label="Dispute window closes" value={formatDateTime(rental.disputeWindowEndsAt)} />
          {rental.releasedAt && (
            <Row
              label="Deposit settled"
              value={`${formatPrice(rental.depositToOwner ?? 0)} owner · ${formatPrice(rental.depositToRenter ?? 0)} renter`}
            />
          )}
        </dl>
      )}

      {transaction && (
        <dl className="divide-y divide-border">
          <Row label="Buyer" value={getUser(transaction.buyerId).name} />
          <Row label="Seller" value={getUser(transaction.sellerId).name} />
          <Row label={transaction.releasedAt ? 'Price (was held in escrow)' : 'Price held in escrow'} value={formatPrice(transaction.price)} strong />
          <Row label="Buyer protection fee" value={formatPrice(transaction.protectionFee)} />
          {transaction.sellerCommission > 0 && (
            <Row
              label={transaction.releasedAt ? 'Sale commission (charged)' : 'Sale commission (10% of what the seller keeps)'}
              value={formatPrice(transaction.sellerCommission)}
            />
          )}
          <Row label="Handed over" value={formatDateTime(transaction.handoverAt)} />
          <Row label="Dispute window closes" value={formatDateTime(transaction.disputeWindowEndsAt)} />
          {transaction.releasedAt && (
            <Row
              label="Settled"
              value={`${formatPrice(transaction.sellerAmount ?? 0)} seller · ${formatPrice(transaction.refundToBuyer)} buyer`}
            />
          )}
        </dl>
      )}
    </section>
  )
}
