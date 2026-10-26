'use client'

// Email + password login (Supabase Auth). After a successful login the
// AuthGuard sends the user on: to ?next=, to /onboarding if it isn't done,
// or home. Unconfirmed accounts get a link to /verify-email to resend the
// confirmation mail.
//
// Includes:
//  - Cloudflare Turnstile CAPTCHA (must pass before submit is allowed)
//  - Accepts both @ait.asia and @ait.ac.th email addresses

import { Suspense, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Mail, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMarketplace } from '@/lib/store'
import { AuthNotice } from '@/components/auth-notice'
import { Turnstile } from '@/components/turnstile'

/** Accept both AIT email domains. */
const isAitEmail = (email: string) =>
  /^[^@\s]+@(ait\.asia|ait\.ac\.th)$/i.test(email)

function LoginInner() {
  const { login } = useMarketplace()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; unconfirmed?: boolean } | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaExpired, setCaptchaExpired] = useState(false)

  const next = searchParams.get('next')
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'

  const onCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token)
    setCaptchaExpired(false)
  }, [])

  const onCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaExpired(true)
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()

    if (!isAitEmail(address)) {
      setError({ message: 'PassItOn is only open to @ait.asia or @ait.ac.th email addresses.' })
      return
    }

    if (!captchaToken) {
      setError({ message: 'Please complete the security check below.' })
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
            ? "That email and password don't match an account."
            : message,
        unconfirmed,
      })
    }
    // On success the AuthGuard redirects; keep the button in its loading state.
  }

  const canSubmit = !loading && !!email && !!password && !!captchaToken

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      {/* Brand header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <span className="font-display text-2xl font-bold text-primary">P</span>
        </div>
        <h1 className="font-display text-4xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Log in with your AIT email to manage listings and messages.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        {searchParams.get('confirmed') && !error && (
          <AuthNotice tone="success" className="mb-5">
            Your email is confirmed. Log in to finish setting up.
          </AuthNotice>
        )}

        {searchParams.get('reason') === 'session_expired' && !error && (
          <AuthNotice tone="info" className="mb-5">
            Your session expired due to inactivity. Please log in again.
          </AuthNotice>
        )}

        {captchaExpired && (
          <AuthNotice tone="error" className="mb-5">
            The security check expired. Please complete it again.
          </AuthNotice>
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
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
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
                placeholder="st123456@ait.asia or name@ait.ac.th"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Accepts @ait.asia and @ait.ac.th addresses.
            </p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor="password"
                className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Password
              </label>
              <Link
                href={
                  email.trim()
                    ? `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`
                    : '/reset-password'
                }
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

          {/* Cloudflare Turnstile CAPTCHA */}
          <div className="pt-1">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Security Check
            </p>
            <div className="overflow-hidden rounded-md border border-border bg-muted/30">
              <Turnstile
                onVerify={onCaptchaVerify}
                onExpire={onCaptchaExpire}
                theme="auto"
              />
            </div>
            {!captchaToken && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Complete the Cloudflare security check to continue.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 text-[13px] font-semibold mt-1"
          >
            {loading ? (
              'Logging in…'
            ) : (
              <>
                Log in <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            New here?
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Sign up CTA */}
        <Link href={signupHref}>
          <Button
            variant="outline"
            className="w-full h-11 text-[13px] font-semibold gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Create an account
          </Button>
        </Link>
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        PassItOn is exclusively for{' '}
        <span className="font-semibold text-foreground">AIT students and staff</span>.
        Your @ait.asia or @ait.ac.th email is required.
      </p>
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
