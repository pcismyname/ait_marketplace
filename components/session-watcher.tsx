'use client'

/**
 * SessionWatcher — handles automatic logout when:
 *  1. The Supabase JWT refresh fails (SIGNED_OUT event after TOKEN_REFRESHED
 *     fails, or a USER_UPDATED event that clears the session).
 *  2. The user's session is explicitly signed out from another tab/device.
 *
 * Also enforces an inactivity auto-logout: if the user is inactive for
 * SESSION_TIMEOUT_MINUTES across ALL open tabs, the session is signed out
 * and the user is redirected to /login with a query param so the page can
 * show a notice.
 *
 * Activity in any tab resets the shared timer (stored in localStorage) so
 * an idle tab never logs the user out while they are active elsewhere.
 *
 * This component renders nothing — it is purely a side-effect component.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

/** Auto-logout after this many minutes of inactivity across all tabs. */
const SESSION_TIMEOUT_MINUTES = 60

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

/** localStorage key shared across tabs. */
const LAST_ACTIVITY_KEY = 'pio_last_activity'

function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
  } catch {
    return Date.now()
  }
}

function writeLastActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
  } catch {
    // localStorage unavailable (private mode edge case) — fail silently
  }
}

export function SessionWatcher() {
  const router = useRouter()
  // Local ref used only to deduplicate rapid activity events (rate-limit writes).
  const lastWriteRef = useRef<number>(0)

  const doLogout = async (reason?: string) => {
    const supabase = createClient()
    await supabase.auth.signOut()
    if (reason) toast.info(reason, { duration: 5000 })
    router.replace('/login?reason=session_expired')
  }

  // ── Inactivity timer ──────────────────────────────────────────────────────
  useEffect(() => {
    // Initialise the shared timestamp on mount so a fresh tab doesn't
    // immediately appear idle.
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) writeLastActivity()

    const bump = () => {
      const now = Date.now()
      // Throttle localStorage writes to once per second to avoid churn.
      if (now - lastWriteRef.current > 1000) {
        lastWriteRef.current = now
        writeLastActivity()
      }
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, bump, { passive: true }))

    const CHECK_INTERVAL_MS = 60_000 // check every minute
    const TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60_000

    const interval = setInterval(() => {
      // Read the shared timestamp — reflects activity in ANY tab.
      if (Date.now() - readLastActivity() >= TIMEOUT_MS) {
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
