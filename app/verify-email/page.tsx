'use client'

// OTP verification page shown after sign-up. The user receives a 6-digit code
// in their AIT email and enters it here. On success they are redirected to
// /onboarding (or the `next` param). The resend button sends a fresh OTP via
// supabase.auth.resend() with a 60-second cooldown.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { AuthNotice } from '@/components/auth-notice'
import { siteOrigin } from '@/lib/utils'

const RESEND_COOLDOWN_SECONDS = 60
const MAILPIT_URL = 'http://127.0.0.1:54324'
const OTP_LENGTH = 8

function isLocalSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)
}

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const nextParam = searchParams.get('next') ?? '/onboarding'

  // OTP state
  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

  // Resend state
  const [sending, setSending] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [resendResult, setResendResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const otpInputRef = useRef<HTMLInputElement>(null)

  // Tick once a second while in cooldown
  useEffect(() => {
    if (cooldownUntil === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [cooldownUntil])

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const address = email.trim().toLowerCase()

  // --- OTP verify ---
  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim().length !== OTP_LENGTH) return
    setVerifying(true)
    setOtpError(null)
    const { error } = await createClient().auth.verifyOtp({
      email: address,
      token: otp.trim(),
      type: 'email',
    })
    setVerifying(false)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid')) {
        setOtpError('Invalid or expired code — request a new one below.')
      } else {
        setOtpError(error.message)
      }
      setOtp('')
      otpInputRef.current?.focus()
      return
    }
    router.replace(nextParam)
  }

  // --- Resend OTP ---
  const onResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || secondsLeft > 0) return
    setSending(true)
    setResendResult(null)
    setOtpError(null)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: address,
      options: { emailRedirectTo: `${siteOrigin()}/onboarding` },
    })
    setSending(false)
    const started = Date.now()
    setNow(started)
    if (error) {
      const wait = error.message.match(/after (\d+) seconds?/i)
      if (wait) setCooldownUntil(started + Number(wait[1]) * 1000)
      setResendResult({ tone: 'error', text: error.message })
      return
    }
    setCooldownUntil(started + RESEND_COOLDOWN_SECONDS * 1000)
    setResendResult({ tone: 'success', text: `New code sent to ${address}.` })
    setOtp('')
    otpInputRef.current?.focus()
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary-muted text-primary mb-6 border border-primary/20">
        <KeyRound className="h-8 w-8" />
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight">Enter your code</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
        {address ? (
          <>We sent a 6-digit verification code to <span className="font-semibold text-foreground">{address}</span>.</>
        ) : (
          <>We sent a 6-digit verification code to your AIT email address.</>
        )}{' '}
        Enter it below to confirm your account.
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Can&apos;t find it? Check your junk folder. Codes expire in 10 minutes.
      </p>

      {isLocalSupabase() && (
        <AuthNotice tone="info" className="mt-6">
          Local development: emails go to Mailpit, not a real inbox.{' '}
          <a href={MAILPIT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            Open Mailpit
          </a>
        </AuthNotice>
      )}

      {/* OTP input form */}
      <form onSubmit={onVerify} className="mt-8 space-y-3 border border-border bg-card p-5 text-left">
        <label htmlFor="otp" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Verification code
        </label>
        <input
          ref={otpInputRef}
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)
            setOtp(val)
            setOtpError(null)
          }}
          placeholder="12345678"
          maxLength={OTP_LENGTH}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-center text-2xl font-mono tracking-[0.5em] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          required
          autoFocus
        />
        {otpError && (
          <AuthNotice tone="error" testId="otp-error">
            {otpError}
          </AuthNotice>
        )}
        <Button
          type="submit"
          disabled={otp.trim().length !== OTP_LENGTH || verifying}
          className="w-full"
        >
          {verifying ? 'Verifying…' : 'Confirm account'}
        </Button>
      </form>

      {/* Resend form */}
      <form onSubmit={onResend} className="mt-4 space-y-3 border border-border bg-card p-5 text-left">
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
          {sending ? 'Sending…' : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </Button>
        {resendResult && (
          <AuthNotice tone={resendResult.tone} testId="resend-result">
            {resendResult.text}
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
