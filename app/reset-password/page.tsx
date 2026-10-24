'use client'

// Password reset (Supabase Auth). Step 1: ask for the AIT email and send the
// reset mail with resetPasswordForEmail; the link comes back here with
// ?step=new (locally the mail lands in Mailpit, http://127.0.0.1:54324).
// Step 2: the browser client picks the recovery session up from the link, and
// the user sets a new password with updateUser. The redirect URL must be in
// Supabase Auth's allowed redirect URLs (Site URL / Redirect URLs).

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { useMarketplace } from '@/lib/store'
import { AuthNotice } from '@/components/auth-notice'

const MIN_PASSWORD = 8
const isAitEmail = (email: string) => /^[^@\s]+@ait\.asia$/i.test(email)
const inputClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10'
const labelClass = 'text-[12px] font-semibold uppercase tracking-wider text-muted-foreground'

function RequestForm({ initialEmail, expired }: { initialEmail: string; expired: boolean }) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    expired ? { tone: 'error', text: 'That reset link has expired or was already used. Ask for a new one.' } : null,
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!isAitEmail(address)) {
      setResult({ tone: 'error', text: 'PassItOn is only open to @ait.asia email addresses.' })
      return
    }
    setSending(true)
    const { error } = await createClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password?step=new`,
    })
    setSending(false)
    // Same message whether or not the account exists, so this can't be used to probe for accounts.
    setResult(
      error && !/rate|security purposes/i.test(error.message)
        ? { tone: 'error', text: error.message }
        : error
          ? { tone: 'error', text: 'Please wait a minute before asking for another email.' }
          : { tone: 'success', text: `If ${address} has an account, a reset link is on its way. Check your inbox.` },
    )
  }

  return (
    <>
      {result && (
        <AuthNotice tone={result.tone} className="mb-5" testId="reset-result">
          {result.text}
        </AuthNotice>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="reset-request-form">
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>AIT Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="st123456@ait.asia"
              className={`${inputClass} pl-9`}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={sending || !email} className="w-full h-11 text-[13px] font-semibold mt-2">
          {sending ? 'Sending…' : <>Send reset link <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
    </>
  )
}

function NewPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`)
    if (password !== confirm) return setError('The two passwords don’t match.')
    setError(null)
    setSaving(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      return
    }
    toast.success('Password updated')
    router.replace('/')
  }

  return (
    <>
      {error && <AuthNotice tone="error" className="mb-5" testId="reset-error">{error}</AuthNotice>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="reset-new-form">
        <div className="space-y-1.5">
          <label htmlFor="password" className={labelClass}>New password</label>
          <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className={labelClass}>Confirm new password</label>
          <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} required />
        </div>
        <Button type="submit" disabled={saving || !password || !confirm} className="w-full h-11 text-[13px] font-semibold mt-2">
          {saving ? 'Saving…' : <>Set new password <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
    </>
  )
}

function ResetPasswordInner() {
  const { isAuthenticated, loading } = useMarketplace()
  const searchParams = useSearchParams()
  const fromLink = searchParams.get('step') === 'new'
  // Supabase puts the reason in the URL when the link is bad (error_code=otp_expired …).
  const linkError = Boolean(searchParams.get('error') || searchParams.get('error_code'))
  const setting = fromLink && isAuthenticated && !linkError

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          {setting ? 'Choose a new password' : 'Reset your password'}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {setting
            ? 'Pick something you haven’t used here before.'
            : 'We’ll email you a link to set a new password.'}
        </p>
      </div>

      <div className="mt-8 border border-border bg-card p-6 md:p-8">
        {fromLink && loading ? (
          <p className="text-center text-[12px] text-muted-foreground">Checking your reset link…</p>
        ) : setting ? (
          <NewPasswordForm />
        ) : (
          <RequestForm initialEmail={searchParams.get('email') ?? ''} expired={fromLink} />
        )}
        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}
