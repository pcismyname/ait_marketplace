'use client'

/**
 * SessionWatcher — handles automatic logout when:
 *  1. The Supabase JWT refresh fails (SIGNED_OUT event after TOKEN_REFRESHED
 *     fails, or a USER_UPDATED event that clears the session).
 *  2. The user's session is explicitly signed out from another tab/device.
 *
 * Also enforces an inactivity auto-logout: if the user is inactive for
 * SESSION_TIMEOUT_MINUTES, the session is signed out and the user is
 * redirected to /login with a query param so the page can show a notice.
 *
 * This component renders nothing — it is purely a side-effect component.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

/** Auto-logout after this many minutes of inactivity. */
const SESSION_TIMEOUT_MINUTES = 60

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function SessionWatcher() {
  const router = useRouter()
  const lastActivityRef = useRef<number>(Date.now())

  const doLogout = async (reason?: string) => {
    const supabase = createClient()
    await supabase.auth.signOut()
    if (reason) toast.info(reason, { duration: 5000 })
    router.replace('/login?reason=session_expired')
  }

  // ── Inactivity timer ──────────────────────────────────────────────────────
  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now() }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, bump, { passive: true }))

    const CHECK_INTERVAL_MS = 60_000 // check every minute
    const TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60_000

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= TIMEOUT_MS) {
        void doLogout(`You've been logged out after ${SESSION_TIMEOUT_MINUTES} minutes of inactivity.`)
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, bump))
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth state listener — catch forced sign-outs ──────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // The middleware or the server already killed the session; redirect.
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
