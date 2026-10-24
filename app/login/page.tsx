'use client'

// Email + password login (Supabase Auth). After a successful login the
// AuthGuard sends the user on: to ?next=, to /onboarding if it isn't done,
// or home. Unconfirmed accounts get a link to /verify-email to resend the
// confirmation mail.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMarketplace } from '@/lib/store'
import { AuthNotice } from '@/components/auth-notice'

const isAitEmail = (email: string) => /^[^@\s]+@ait\.asia$/i.test(email)

function LoginInner() {
  const { login } = useMarketplace()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; unconfirmed?: boolean } | null>(null)
  const next = searchParams.get('next')
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!isAitEmail(address)) {
      setError({ message: 'PassItOn is only open to @ait.asia email addresses.' })
      return
    }
    setError(null)
    setLoading(true)
    const message = await login(address, password)
    if (message) {
      setLoading(false)
      const unconfirmed = /not confirmed/i.test(message)
      setError({
        message: unconfirmed
          ? 'Confirm your email address first. We sent you a link when you signed up.'
          : /invalid login credentials/i.test(message)
            ? 'That email and password don’t match an account.'
            : message,
        unconfirmed,
      })
    }
    // On success the AuthGuard redirects; keep the button in its loading state.
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Log in to manage your listings and messages.
        </p>
      </div>

      <div className="mt-8 border border-border bg-card p-6 md:p-8">
        {searchParams.get('confirmed') && !error && (
          <AuthNotice tone="success" className="mb-5">Your email is confirmed. Log in to finish setting up.</AuthNotice>
        )}
        {error && (
          <AuthNotice tone="error" className="mb-5" testId="login-error">
            {error.message}
            {error.unconfirmed && (
              <>
                {' '}
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                  className="font-semibold underline underline-offset-2"
                >
                  Resend the confirmation email
                </Link>
              </>
            )}
          </AuthNotice>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              AIT Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="st123456@ait.asia"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <Link
                href={email.trim() ? `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}` : '/reset-password'}
                className="text-[12px] font-medium text-primary hover:underline"
                data-testid="forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          <Button type="submit" disabled={loading || !email || !password} className="w-full h-11 text-[13px] font-semibold mt-2">
            {loading ? 'Logging in...' : (
              <>Log in <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          New to PassItOn?{' '}
          <Link href={signupHref} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
