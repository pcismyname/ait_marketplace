'use client'

// Sign up with an AIT email (Supabase Auth). The @ait.asia rule is enforced
// by the server: the before_user_created hook answers with a friendly 403
// message, and the enforce_ait_email trigger on auth.users backs it up
// ("Database error saving new user" when the hook is off). This page shows
// whatever the server says instead of only checking the domain in the
// browser. With email confirmation on, the user goes to /verify-email; with
// it off (local dev), the AuthGuard sends the new session to /onboarding.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Mail, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { AuthNotice } from '@/components/auth-notice'

const MIN_PASSWORD = 6
const AIT_ONLY = 'PassItOn is only open to @ait.asia email addresses.'
const isAitEmail = (email: string) => /^[^@\s]+@ait\.asia$/i.test(email)

/** Turn the auth server's answer into something a student can act on. */
function explainSignupError(message: string): { text: string; login?: boolean; server: boolean } {
  if (/ait\.asia/i.test(message)) return { text: message, server: true }
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

    if (password.length < MIN_PASSWORD) {
      setError({ text: `Use a password of at least ${MIN_PASSWORD} characters.`, server: false })
      return
    }

    // The domain rule is checked by the server (hook + trigger); we send the
    // request even for other domains so the server's answer is what you see.
    setLoading(true)
    const onboarding = next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding'
    const { data, error: signUpError } = await createClient().auth.signUp({
      email: address,
      password,
      options: {
        data: name.trim() ? { name: name.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}${onboarding}`,
      },
    })
    if (signUpError) {
      setLoading(false)
      setError(explainSignupError(signUpError.message))
      return
    }
    if (data.session) {
      // Signed in straight away (email confirmation off): the AuthGuard
      // moves us to /onboarding.
      return
    }
    setLoading(false)
    router.push(`/verify-email?email=${encodeURIComponent(address)}`)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-primary">PassItOn</h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Create your account</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Join the AIT circular marketplace.
        </p>
      </div>

      <div className="mt-8 border border-border bg-card p-6 md:p-8">
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
              <Link href={`/login?email=${encodeURIComponent(address)}`} className="font-semibold underline underline-offset-2">
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
                <label htmlFor="name" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Your name <span className="normal-case font-normal tracking-normal">(optional)</span>
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
                <label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AIT Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="st123456@ait.asia"
                  aria-invalid={domainWarning || undefined}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 aria-invalid:border-destructive/60"
                  required
                />
                <p className={`text-[11px] mt-1 ${domainWarning ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {domainWarning
                    ? 'Only @ait.asia addresses can join. Other addresses are refused.'
                    : 'Only @ait.asia addresses can join. We send a confirmation link to it.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <label htmlFor="appId" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <p className="text-[11px] text-muted-foreground mt-1">For incoming students who don&apos;t have an AIT email yet.</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (method === 'email' ? !email || !password : !appId)}
            className="w-full h-11 text-[13px] font-semibold mt-2"
          >
            {loading ? 'Creating account...' : (
              <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
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
