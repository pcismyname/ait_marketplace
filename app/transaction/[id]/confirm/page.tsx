'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function ConfirmTransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      toast.success('Transaction complete!', { description: 'Funds have been released to the seller.' })
      router.push('/dashboard/orders')
    }, 1000)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-16">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Confirm Receipt</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Release escrow funds to the seller.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-8">
          <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold">Important</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              By confirming receipt, you agree that you have inspected the item and accept it in its current condition. 
              <strong> The escrow funds will be immediately released to the seller.</strong> This action cannot be undone.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-muted/50">
            <div className="pt-1">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-5 w-5 rounded-sm border-primary text-primary focus:ring-primary"
              />
            </div>
            <div>
              <p className="text-[14px] font-semibold">I have received and inspected the item</p>
              <p className="mt-1 text-[12px] text-muted-foreground">It matches the description and I am satisfied with the condition.</p>
            </div>
          </label>

          <div className="space-y-2">
            <label htmlFor="feedback" className="text-[13px] font-semibold">Leave a review for the seller (Optional)</label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Was the seller punctual? Was the item as described?"
              className="min-h-[100px] text-[13px] resize-none"
            />
          </div>

          <Button type="submit" disabled={!confirmed || submitting} className="w-full h-11 text-[13px] font-semibold">
            {submitting ? 'Releasing funds...' : 'Confirm & Release Funds'}
          </Button>
        </form>
      </div>
    </div>
  )
}
