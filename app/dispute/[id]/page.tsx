'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, AlertOctagon, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function DisputePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      toast.success('Dispute filed successfully', { description: 'The escrow funds have been frozen while we investigate.' })
      router.push(`/transaction/${params.id}`)
    }, 1500)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-16">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-3 mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">File a Dispute</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          If there's an issue with Transaction {params.id}, let us know. Escrow funds will be frozen immediately.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reason for dispute
            </label>
            <Select required value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select an issue..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_described">Item not as described</SelectItem>
                <SelectItem value="damaged">Item is damaged/broken</SelectItem>
                <SelectItem value="no_show">Seller did not show up</SelectItem>
                <SelectItem value="fake">Item is counterfeit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </label>
            <Textarea
              required
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide as much detail as possible about the issue..."
              className="min-h-[120px] text-[13px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence (Optional)
            </label>
            <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface hover:bg-muted/50 transition-colors">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-[12px] font-medium text-foreground">Click to upload photos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">JPG, PNG up to 5MB</p>
              <input type="file" className="hidden" multiple accept="image/*" />
            </label>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-[11px] leading-relaxed text-muted-foreground mb-4">
              By submitting this dispute, you agree to cooperate with PassItOn administrators. False disputes may result in account suspension.
            </p>
            <Button type="submit" variant="destructive" disabled={submitting || !reason || !details} className="w-full h-11 text-[13px] font-semibold">
              {submitting ? 'Submitting...' : 'Freeze Escrow & Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
