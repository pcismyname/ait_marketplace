'use client'

// "Rate <name>" for a closed deal, used in lists (/rentals cards and
// /dashboard/orders rows). The deal page (/transaction/[id]) mounts the same
// ReviewDialog itself. Pair with useReviewedDeals() so the button turns into
// "Rated" once the viewer has reviewed the deal.

import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { listMyReviewedDealIds } from '@/lib/api'
import { useMarketplace } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ReviewDialog, type ReviewTarget } from '@/components/review-dialog'
import { cn } from '@/lib/utils'

/** The deal ids the signed-in user already reviewed (one query), plus a way to add one after submit. */
export function useReviewedDeals() {
  const { currentUserId } = useMarketplace()
  const [reviewed, setReviewed] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    listMyReviewedDealIds()
      .then((ids) => {
        if (!cancelled) setReviewed(ids)
      })
      .catch(() => {
        if (!cancelled) setReviewed(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  const markReviewed = useCallback((id: string) => {
    setReviewed((prev) => new Set(prev ?? []).add(id))
  }, [])

  return { reviewed, markReviewed }
}

export function RateDealButton({
  target,
  subjectName,
  subjectRole,
  reviewed,
  onRated,
  className,
}: {
  target: ReviewTarget
  subjectName: string
  subjectRole?: 'owner' | 'renter' | 'seller' | 'buyer'
  /** undefined while still loading: renders nothing. */
  reviewed: boolean | undefined
  onRated: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (reviewed === undefined) return null
  if (reviewed) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[12px] text-muted-foreground', className)}>
        <Star className="h-3.5 w-3.5 text-surge" fill="currentColor" aria-hidden="true" />
        You rated {subjectName}
      </span>
    )
  }
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={className} onClick={() => setOpen(true)} data-testid="rate-deal">
        <Star className="h-3.5 w-3.5" aria-hidden="true" />
        Rate {subjectName}
      </Button>
      <ReviewDialog
        target={target}
        subjectName={subjectName}
        subjectRole={subjectRole}
        open={open}
        onOpenChange={setOpen}
        onSubmitted={onRated}
      />
    </>
  )
}
