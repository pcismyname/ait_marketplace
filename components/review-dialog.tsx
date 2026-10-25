'use client'

// "Rate the other party" after a deal closes (figures/*_userflow.png end in
// a rating step). Calls submit_review through lib/api; the server checks the
// deal is closed (rental released / resolved / missing, sale released /
// resolved / completed), allows one review per author per deal, and updates
// the reviewed user's rating.
//
// Props:
//   target       { rentalId } or { transactionId } — exactly one.
//   subjectName  Name of the person being rated (title and placeholder copy).
//   subjectRole  Optional label for them: 'owner' | 'renter' | 'seller' | 'buyer'.
//   open / onOpenChange   Controlled dialog state.
//   onSubmitted  Called with the saved Review after a successful submit.
//
// Pair it with getMyReviewForDeal(target) from lib/api to hide the button
// once the viewer has already rated the deal.

import { useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { submitReview } from '@/lib/api'
import type { Review } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ReviewTarget = { rentalId: string; transactionId?: never } | { transactionId: string; rentalId?: never }

export interface ReviewDialogProps {
  target: ReviewTarget
  subjectName: string
  subjectRole?: 'owner' | 'renter' | 'seller' | 'buyer'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: (review: Review) => void
}

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

export function ReviewDialog({ target, subjectName, subjectRole, open, onOpenChange, onSubmitted }: ReviewDialogProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const shown = hover || rating

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) return
    setSubmitting(true)
    try {
      const review = await submitReview({ ...target, rating, comment: comment.trim() || undefined })
      toast.success('Thanks for the review', { description: `Your rating for ${subjectName} is saved.` })
      onSubmitted?.(review)
      onOpenChange(false)
      setRating(0)
      setComment('')
    } catch (error) {
      toast.error('Could not save the review', {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">Rate {subjectName}</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {subjectRole ? `How was ${subjectName} as the ${subjectRole}? ` : ''}
              Your rating shows on their profile and helps other AIT students trade with confidence.
            </DialogDescription>
          </DialogHeader>

          <fieldset>
            <legend className="sr-only">Rating</legend>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHover(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                  aria-pressed={rating === value}
                  className="p-1"
                >
                  <Star
                    className={cn('h-7 w-7 transition-colors', value <= shown ? 'text-surge' : 'text-muted-foreground/30')}
                    fill={value <= shown ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
              <span className="ml-2 text-[13px] text-muted-foreground">{RATING_WORDS[shown]}</span>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="review-comment" className="text-[12px] font-semibold">
              Comment <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="On time at pickup? Item as described?"
              className="min-h-[90px] resize-none text-[13px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Not now
            </Button>
            <Button type="submit" disabled={rating < 1 || submitting}>
              {submitting ? 'Saving…' : 'Submit rating'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
