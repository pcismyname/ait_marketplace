'use client'

// Route guard. Waits for the store to know the auth state (`loading`) before
// deciding, so a hard refresh of a deep link (e.g. /chat?thread=…) isn't
// bounced to /login. Logged-out visitors go to /login?next=<where they were>;
// signed-in users on /login or /signup go to `next`, or to /onboarding if they
// haven't finished it yet (users.onboarded_at), otherwise home.

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useMarketplace } from '@/lib/store'
import { getMyOnboarding } from '@/lib/api/onboarding'

/** Pages anyone can open. */
const PUBLIC_PATHS = ['/login', '/signup', '/verify-email', '/reset-password']
/** Pages a signed-in user is sent away from. */
const AUTH_PATHS = ['/login', '/signup']

/**
 * Only same-site paths may be used as a redirect. Browsers strip tabs/newlines
 * and treat `\` like `/`, so `/<TAB>/evil.com` or `/\evil.com` would become
 * `//evil.com`: reject control characters, whitespace and backslashes outright,
 * then resolve against our origin and require it to stay on it. Returns the
 * normalised path + search + hash.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (/[\x00-\x1f\x7f\s\\]/.test(next)) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  let url: URL
  try {
    url = new URL(next, origin)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  const path = `${url.pathname}${url.search}${url.hash}`
  if (path.startsWith('//')) return null
  if (AUTH_PATHS.some((p) => url.pathname === p)) return null
  return path
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, currentUserId } = useMarketplace()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isAuthPage = AUTH_PATHS.includes(pathname)
  const next = searchParams.get('next')

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && !isPublic) {
      const query = searchParams.toString()
      const here = query ? `${pathname}?${query}` : pathname
      router.replace(here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`)
      return
    }
    if (isAuthenticated && isAuthPage) {
      let cancelled = false
      const target = safeNext(next)
      getMyOnboarding().then(
        (me) => {
          if (cancelled) return
          if (!me?.onboardedAt) router.replace(target ? `/onboarding?next=${encodeURIComponent(target)}` : '/onboarding')
          else router.replace(target ?? '/')
        },
        () => {
          if (!cancelled) router.replace(target ?? '/')
        },
      )
      return () => {
        cancelled = true
      }
    }
  }, [loading, isAuthenticated, isPublic, isAuthPage, pathname, searchParams, next, router, currentUserId])

  if (isPublic) return <>{children}</>
  if (loading || !isAuthenticated) return null
  return <>{children}</>
}
