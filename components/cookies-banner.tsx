'use client'

/**
 * GDPR-style cookie consent banner.
 * Persists the user's choice in localStorage under the key "cookie_consent".
 * Values: "accepted" | "rejected" | null (not decided yet → show banner).
 *
 * The banner slides up from the bottom and disappears once the user acts.
 */

import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'cookie_consent'
type Consent = 'accepted' | 'rejected' | null

export function CookiesBanner() {
  const [consent, setConsent] = useState<Consent | 'loading'>('loading')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Consent | null
    setConsent(stored)
  }, [])

  const decide = (value: 'accepted' | 'rejected') => {
    localStorage.setItem(STORAGE_KEY, value)
    setConsent(value)
  }

  // Still loading or already decided – render nothing.
  if (consent !== null) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-6 md:max-w-md animate-in slide-in-from-bottom-6 duration-500"
    >
      <div className="relative rounded-xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-sm">
        {/* Dismiss icon – same as reject */}
        <button
          onClick={() => decide('rejected')}
          aria-label="Dismiss cookie banner"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              We use cookies 🍪
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              PassItOn uses essential cookies to keep you logged in and
              optional analytics cookies to improve the marketplace. You can
              accept or decline optional cookies.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => decide('rejected')}
            className="h-8 text-[12px] font-semibold"
          >
            Decline optional
          </Button>
          <Button
            size="sm"
            onClick={() => decide('accepted')}
            className="h-8 text-[12px] font-semibold"
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}
