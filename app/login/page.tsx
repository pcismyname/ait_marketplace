'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Mail } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display italic text-3xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Log in to manage your listings and messages.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <form className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              AIT Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                placeholder="st123456@ait.asia"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <a href="#" className="text-[11px] font-medium text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          <Button type="submit" className="w-full h-11 text-[13px] font-semibold mt-2">
            Log in <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          New to PassItOn?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
