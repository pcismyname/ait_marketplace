'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Mail, FileText } from 'lucide-react'

export default function SignupPage() {
  const [method, setMethod] = useState<'email' | 'appId'>('email')

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display italic text-3xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Create your account</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Join the AIT circular marketplace.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex rounded-md border border-border bg-muted/50 p-1 mb-6">
          <button
            onClick={() => setMethod('email')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-2 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              method === 'email' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            AIT Email
          </button>
          <button
            onClick={() => setMethod('appId')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-2 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              method === 'appId' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            App ID
          </button>
        </div>

        <form className="space-y-4">
          {method === 'email' ? (
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                AIT Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="st123456@ait.asia"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">We will send a magic link to this address.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="appId" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Application Number
              </label>
              <input
                id="appId"
                type="text"
                placeholder="e.g. AIT-2026-XXXX"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">For incoming students who don't have an AIT email yet.</p>
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-[13px] font-semibold mt-2">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
