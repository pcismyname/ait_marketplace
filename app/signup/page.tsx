'use client'

// Sign up with an AIT email (Supabase Auth). Accepts both @ait.asia and
// @ait.ac.th email addresses.
//
// Flow (email method):
//  1. User fills form → clicks Continue → supabase.auth.signUp() fires
//  2. Supabase sends a real 6-digit OTP to the user's AIT email
//     (requires "OTP" mode in Supabase Dashboard → Auth → Email)
//  3. User is redirected to /verify-email?email=... to enter the OTP
//  4. verifyOtp({ type: 'signup' }) confirms the account → /onboarding
//
// Flow (App ID method):
//  Simulated only — shows a notice. Real AIT registry integration is (open).

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Mail, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { AuthNotice } from '@/components/auth-notice'
import { siteOrigin } from '@/lib/utils'

const MIN_PASSWORD = 6
const AIT_ONLY = 'PassItOn is only open to @ait.asia or @ait.ac.th email addresses.'

/** Accept both AIT email domains. */
const isAitEmail = (email: string) =>
  /^[^@\s]+@(ait\.asia|ait\.ac\.th)$/i.test(email)

/** Turn the auth server's answer into something a student can act on. */
function explainSignupError(message: string): { text: string; login?: boolean; server: boolean } {
  if (/ait\.asia|ait\.ac\.th/i.test(message)) return { text: message, server: true }
  if (/database error saving new user/i.test(message)) return { text: AIT_ONLY, server: true }
  if (/already registered|already been registered|already exists/i.test(message)) {
    return { text: 'An account with this email already exists.', login: true, server: true }
  }
  if (/password/i.test(message)) return { text: message, server: true }
  if (/rate limit|too many/i.test(message)) return { text: 'Too many attempts. Wait a minute and try again.', server: true }
  return { text: message, server: true }
}

function SignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const [method, setMethod] = useState<'email' | 'appId'>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [appId, setAppId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ReturnType<typeof explainSignupError> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const address = email.trim().toLowerCase()
  const domainWarning = address.includes('@') && !isAitEmail(address)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (method === 'appId') {
      if (!appId.trim().toUpperCase().startsWith('AIT-')) {
        setError({ text: 'Enter a valid Application ID starting with AIT-.', server: false })
        return
      }
      setNotice('Application ID sign-up is not connected yet. Use your AIT email once you have it.')
      return
    }

    if (!isAitEmail(address)) {
      setError({ text: AIT_ONLY, server: false })
      return
    }

    if (password.length < MIN_PASSWORD) {
      setError({ text: `Use a password of at least ${MIN_PASSWORD} characters.`, server: false })
      return
    }

    setLoading(true)

    // Call signUp() — Supabase sends a real OTP to the user's AIT email.
    // Requires "OTP" confirmation mode in Supabase Dashboard → Auth → Email.
    const onboarding = next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding'
    const { data, error: signUpError } = await createClient().auth.signUp({
      email: address,
      password,
      options: {
        data: name.trim() ? { name: name.trim() } : undefined,
        // emailRedirectTo is used as a fallback if Supabase falls back to link mode.
        emailRedirectTo: `${siteOrigin()}${onboarding}`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(explainSignupError(signUpError.message))
      return
    }

    if (data.session) {
      // Email confirmation is disabled (local dev): session is already live.
      // AuthGuard will redirect to /onboarding.
      return
    }

    // OTP sent — take the user to the verification page.
    setLoading(false)
    router.push(`/verify-email?email=${encodeURIComponent(address)}${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      {/* Brand header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <span className="font-display text-2xl font-bold text-primary">P</span>
        </div>
        <h1 className="font-display text-4xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Create your account</h2>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Join the AIT circular marketplace — buy, sell and rent on campus.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        {/* Method toggle */}
        <div className="flex rounded-md border border-border bg-muted/50 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMethod('email'); setError(null); setNotice(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-2 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              method === 'email' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            AIT Email
          </button>
          <button
            type="button"
            onClick={() => { setMethod('appId'); setError(null); setNotice(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-2 text-[12px] font-semibold uppercase tracking-wider transition-all ${
              method === 'appId' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            App ID
          </button>
        </div>

        {error && (
          <AuthNotice tone="error" className="mb-5" testId="signup-error">
            {error.server && <p className="font-semibold">Sign-up refused</p>}
            <p>{error.text}</p>
            {error.login && (
              <Link
                href={`/login?email=${encodeURIComponent(address)}`}
                className="font-semibold underline underline-offset-2"
              >
                Log in instead
              </Link>
            )}
          </AuthNotice>
        )}
        {notice && <AuthNotice tone="info" className="mb-5">{notice}</AuthNotice>}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {method === 'email' ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Your name{' '}
                  <span className="normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex W."
                  maxLength={80}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  AIT Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="st123456@ait.asia or name@ait.ac.th"
                  aria-invalid={domainWarning || undefined}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 aria-invalid:border-destructive/60"
                  required
                />
                <p className={`text-[11px] mt-1 ${domainWarning ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {domainWarning
                    ? 'Only @ait.asia or @ait.ac.th addresses are accepted.'
                    : 'Accepts @ait.asia (students) and @ait.ac.th (staff). A 6-digit verification code will be sent.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  required
                />
                <p className="text-[11px] text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="appId"
                className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Application Number
              </label>
              <input
                id="appId"
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. AIT-2026-XXXX"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                For incoming students who don&apos;t have an AIT email yet.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (method === 'email' ? !email || !password : !appId)}
            className="w-full h-11 text-[13px] font-semibold mt-2"
          >
            {loading ? 'Sending verification code…' : (
              <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="font-semibold text-primary hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        By creating an account you agree to PassItOn&apos;s{' '}
        <span className="font-semibold text-foreground">Terms of Service</span> and{' '}
        <span className="font-semibold text-foreground">Privacy Policy</span>.
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  )
}
