'use client'

// "Check your inbox" after sign-up when email confirmation is on. Resends the
// confirmation mail with supabase.auth.resend({ type: 'signup' }). Locally the
// mail lands in Mailpit (http://127.0.0.1:54324). The link in the mail
// confirms the address and comes back to /onboarding, where the browser
// client picks up the session.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { AuthNotice } from '@/components/auth-notice'

const RESEND_COOLDOWN_SECONDS = 60
const MAILPIT_URL = 'http://127.0.0.1:54324'

function isLocalSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)
}

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [sending, setSending] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Tick once a second while the resend button is cooling down.
  useEffect(() => {
    if (cooldownUntil === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [cooldownUntil])

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const address = email.trim().toLowerCase()

  const onResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || secondsLeft > 0) return
    setSending(true)
    setResult(null)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    })
    setSending(false)
    const started = Date.now()
    setNow(started)
    if (error) {
      const wait = error.message.match(/after (\d+) seconds?/i)
      if (wait) setCooldownUntil(started + Number(wait[1]) * 1000)
      setResult({ tone: 'error', text: error.message })
      return
    }
    setCooldownUntil(started + RESEND_COOLDOWN_SECONDS * 1000)
    setResult({ tone: 'success', text: `We sent a new confirmation link to ${address}.` })
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary-muted text-primary mb-6 border border-primary/20">
        <MailCheck className="h-8 w-8" />
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight">Check your inbox</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
        {address ? (
          <>We sent a confirmation link to <span className="font-semibold text-foreground">{address}</span>.</>
        ) : (
          <>We sent a confirmation link to your AIT email address.</>
        )}{' '}
        Open it to confirm your account, then finish setting up your profile.
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Can&apos;t find it? Check your junk folder; the email comes from our sign-in service.
      </p>

      {isLocalSupabase() && (
        <AuthNotice tone="info" className="mt-6">
          Local development: emails go to Mailpit, not a real inbox.{' '}
          <a href={MAILPIT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            Open Mailpit
          </a>
        </AuthNotice>
      )}

      <form onSubmit={onResend} className="mt-8 space-y-3 border border-border bg-card p-5 text-left">
        <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Didn&apos;t get it? Resend to
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="st123456@ait.asia"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          required
        />
        <Button type="submit" variant="outline" disabled={!address || sending || secondsLeft > 0} className="w-full">
          {sending ? 'Sending…' : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend confirmation email'}
        </Button>
        {result && (
          <AuthNotice tone={result.tone} testId="resend-result">
            {result.text}
          </AuthNotice>
        )}
      </form>

      <div className="mt-12 text-[13px]">
        <Link
          href={address ? `/login?email=${encodeURIComponent(address)}` : '/login'}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          &larr; Back to login
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  )
}
