'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [program, setProgram] = useState('')
  const [batch, setBatch] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Redirect to home/browse on complete
    router.push('/browse')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <p className="label-tag mb-2 text-primary">Welcome to PassItOn</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Complete your profile</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Just a few details so other students know who they are trading with.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex W."
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="program" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Program
            </label>
            <input
              id="program"
              type="text"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. Computer Science"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="batch" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Batch / Year
            </label>
            <input
              id="batch"
              type="text"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="e.g. Fall '26"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          <Button type="submit" className="w-full h-11 text-[13px] font-semibold mt-4">
            Finish Setup <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
