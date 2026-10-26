'use client'

/**
 * Simulated AIT email verification modal / inline widget.
 *
 * Shown immediately after a user submits the sign-up form before any real
 * Supabase call is made. The flow is:
 *
 *  1. User fills in name/email/password and clicks "Continue".
 *  2. This component appears, simulating "we emailed your AIT address".
 *  3. After a short delay (2 s) the "email" auto-arrives (simulated).
 *  4. The user enters the 6-digit code and clicks "Verify".
 *  5. On success, the parent's onVerified() callback fires, which actually
 *     calls supabase.auth.signUp().
 *
 * The simulated code is always "123456" (shown to the user as a hint
 * because this is a demo). In a real deployment, remove the hint and wire up
 * Supabase's own email confirmation flow instead.
 */

import { useEffect, useState, useRef } from 'react'
import { MailCheck, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SIMULATED_CODE = '123456'
const AUTO_ARRIVE_MS = 2000   // 2 seconds after modal opens
const RESEND_COOLDOWN = 30    // seconds

interface SimulatedEmailVerifyProps {
  email: string
  onVerified: () => void
  onCancel: () => void
}

export function SimulatedEmailVerify({
  email,
  onVerified,
  onCancel,
}: SimulatedEmailVerifyProps) {
  const [code, setCode] = useState('')
  const [arrived, setArrived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Simulate the email arriving after AUTO_ARRIVE_MS
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), AUTO_ARRIVE_MS)
    return () => clearTimeout(t)
  }, [])

  // Focus the code input once the email "arrives"
  useEffect(() => {
    if (arrived) inputRef.current?.focus()
  }, [arrived])

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim() === SIMULATED_CODE) {
      setVerified(true)
      setError(null)
      setTimeout(() => onVerified(), 800) // brief success flash
    } else {
      setError('Incorrect code. Try again. (Hint: check your inbox 😉)')
      setCode('')
      inputRef.current?.focus()
    }
  }

  const handleResend = () => {
    setArrived(false)
    setCode('')
    setError(null)
    setResendCooldown(RESEND_COOLDOWN)
    const t = setTimeout(() => setArrived(true), AUTO_ARRIVE_MS)
    return () => clearTimeout(t)
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 animate-in zoom-in-95 duration-300">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {verified ? (
            <CheckCircle2 className="h-8 w-8 text-green-600 animate-in zoom-in-75 duration-300" />
          ) : (
            <MailCheck className="h-8 w-8" />
          )}
        </div>

        <h2 className="text-center text-lg font-semibold tracking-tight">
          {verified ? 'Email verified!' : 'Verify your AIT email'}
        </h2>

        {!verified && (
          <>
            <p className="mt-2 text-center text-[13px] text-muted-foreground leading-relaxed">
              {arrived ? (
                <>
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-foreground">{email}</span>.
                  Enter it below to confirm your account.
                </>
              ) : (
                <>
                  Sending a 6-digit code to{' '}
                  <span className="font-semibold text-foreground">{email}</span>…
                </>
              )}
            </p>

            {/* Simulated "inbox preview" — appears when email arrives */}
            {arrived && (
              <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-[12px] animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MailCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="font-semibold text-foreground">📬 New email from PassItOn</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Subject: Confirm your PassItOn account
                </p>
                <p className="mt-2 font-mono text-base font-bold text-foreground tracking-[0.25em] text-center">
                  {SIMULATED_CODE}
                </p>
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  (Simulated — in production this arrives in your real AIT inbox)
                </p>
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="verify-code"
                  className="block text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Verification Code
                </label>
                <input
                  ref={inputRef}
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={!arrived || verified}
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                  required
                />
                {error && (
                  <p className="mt-1.5 text-[12px] text-destructive">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={code.length < 6 || !arrived}
                className="w-full h-10 text-[13px] font-semibold"
              >
                Verify &amp; create account
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-[12px]">
              <button
                type="button"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || !arrived}
                className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-default"
              >
                <RefreshCw className="h-3 w-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        {verified && (
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            Setting up your account…
          </p>
        )}
      </div>
    </div>
  )
}
